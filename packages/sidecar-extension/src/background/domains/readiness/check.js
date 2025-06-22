import { CHECK_READINESS } from '@hybrid-thinking/messaging';
import { findTabByPlatform } from '../../utils/tab-manager.js';

let configs = {};
let configsLoaded = false;

async function loadConfigs() {
  if (configsLoaded) return;
  
  try {
    const configNames = ['chatgpt', 'claude'];
    
    for (const name of configNames) {
      const url = chrome.runtime.getURL(`content/configs/${name}.json`);
      const response = await fetch(url);
      configs[name] = await response.json();
    }
    
    configsLoaded = true;
  } catch (error) {
    console.error('[Check] Failed to load configs:', error);
  }
}

async function getProviderConfig(providerKey) {
  await loadConfigs();
  const config = configs[providerKey];
  if (!config) {
    throw new Error(`Config file not found for provider: ${providerKey}`);
  }
  return config;
}

async function waitForContentScriptReady(tabId, maxRetries = 3, initialDelay = 500) {
  if (typeof tabId !== 'number') {
    throw new TypeError('Invalid tabId: must be a number.');
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    console.log(`[ContentScript] Verifying tab ${tabId}: ${tab.url}`);
  } catch (error) {
    throw new Error(`Tab ${tabId} not accessible: ${error.message}`);
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const delay = initialDelay * Math.pow(2, attempt - 1); // Exponential backoff
      console.log(`[ContentScript] Attempt ${attempt}/${maxRetries}, waiting ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));

      const response = await chrome.tabs.sendMessage(tabId, { type: 'HEALTH_CHECK' });

      if (response?.healthy) {
        console.log(`[ContentScript] Ready on attempt ${attempt}.`);
        return;
      }
      throw new Error('Health check failed or returned unhealthy.');
    } catch (error) {
      console.warn(`[ContentScript] Attempt ${attempt} failed: ${error.message}`);
      if (attempt === maxRetries) {
        throw new Error(`Content script not ready after ${maxRetries} attempts.`);
      }
    }
  }
}



async function injectContentScriptFallback(tabId) {
  try {
    console.log(`[ContentScript] Attempting manual injection fallback for tab ${tabId}`);
    
    // Try to inject the content script manually
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/content.js']
    });
    
    console.log(`[ContentScript] Manual injection completed for tab ${tabId}`);
    
    // Wait a bit for the script to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } catch (error) {
    console.warn(`[ContentScript] Manual injection failed for tab ${tabId}:`, error.message);
    throw error;
  }
}

export async function check({ providerKey }) {
  const config = await getProviderConfig(providerKey);
  const tab = await findTabByPlatform(providerKey);

  if (!tab || typeof tab.tabId !== 'number') {
    return { status: 'TAB_NOT_OPEN', message: `${config.name} tab not found.`, data: { url: config.url } };
  }

  try {
    await waitForContentScriptReady(tab.tabId);
  } catch (error) {
    console.warn(`[Handler:CheckReadiness] Content script not ready. Attempting manual injection for tab ${tab.tabId}...`);
    try {
      await injectContentScriptFallback(tab.tabId);
      await waitForContentScriptReady(tab.tabId, 2, 1000); // Re-check after injection
    } catch (fallbackError) {
      return { 
        status: 'TAB_NOT_READY', 
        message: 'Content script failed to load. Please refresh the tab.', 
        data: { url: config.url, error: fallbackError.message } 
      };
    }
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.tabId, {
      type: CHECK_READINESS,
      payload: { config },
    });

    if (!response?.success) {
      throw new Error(response?.error || 'Readiness check failed.');
    }

    return { status: response.status, message: response.message, data: { tabId: tab.tabId } };
  } catch (error) {
    console.error(`[Handler:CheckReadiness] Final check failed for ${providerKey}:`, error);
    return { 
      status: 'TAB_NOT_READY', 
      message: 'Connection to tab failed. It may be loading or unresponsive.', 
      data: { url: config.url, error: error.message }
    };
  }
}