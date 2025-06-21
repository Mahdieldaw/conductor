import { CHECK_READINESS } from '@hybrid-thinking/messaging';
import { findTabByPlatform } from '../../utils/tab-finder.js';

// It's safe to use import.meta.glob here in the service worker.
const configs = import.meta.glob('/src/content/configs/*.json', { eager: true });

function getProviderConfig(providerKey) {
  const path = `/src/content/configs/${providerKey}.json`;
  const configModule = configs[path];
  if (!configModule) {
    throw new Error(`Config file not found for provider: ${providerKey}`);
  }
  return configModule.default || configModule;
}

/**
 * Dynamically injects the content script as a module.
 * This is the modern, correct way to handle scripts that use import/export.
 * @param {number} tabId The ID of the tab to inject the script into.
 */
async function injectContentModule(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      // The function body runs in the content script context.
      // We use dynamic import() which correctly handles modules.
      // This guard prevents the script from running multiple times if injected again.
      if (window.sidecarInjected) {
        console.log('[Sidecar] Module already injected. Skipping.');
        return;
      }
      window.sidecarInjected = true;
      try {
        import(chrome.runtime.getURL('content/content.js'));
        console.log('[Sidecar] Module injection initiated.');
      } catch (e) {
        console.error('[Sidecar] Module import failed:', e);
      }
    },
  });
}

/**
 * Checks the readiness of a specific LLM platform tab by first ensuring
 * the content script module is loaded, then sending a message.
 */
export async function check({ providerKey }) {
  const config = getProviderConfig(providerKey);
  const tab = findTabByPlatform(providerKey);
  
  if (!tab) {
    return { status: 'TAB_NOT_OPEN', message: `${config.name || providerKey} tab is not open.`, data: { url: config.url } };
  }

  try {
    console.log(`[Handler:CheckReadiness] Injecting content module into tab ${tab.id}`);
    await injectContentModule(tab.id);

    // Give the module a moment to load and attach its listener.
    await new Promise(resolve => setTimeout(resolve, 100)); 

    console.log(`[Handler:CheckReadiness] Sending readiness check to tab ${tab.id}`);
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: CHECK_READINESS,
      payload: { config }
    });
    
    if (!response || response.success === false) {
      throw new Error(response?.error || 'Content script did not respond correctly.');
    }
    
    return { status: response.status, message: response.message, data: { tabId: tab.id } };

  } catch (error) {
    console.error(`[Handler:CheckReadiness] Error checking readiness for ${providerKey} in tab ${tab.id}:`, error);
    
    if (error.message.includes("Could not establish connection")) {
      return { status: 'TAB_NOT_READY', message: 'Tab is still loading or not responding. Please try rechecking.', data: { url: config.url } };
    }
    
    throw new Error(`Failed to check readiness for ${providerKey}: ${error.message}`);
  }
}