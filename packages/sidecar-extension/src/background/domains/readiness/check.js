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
  // Handle default export from JSON modules
  return configModule.default || configModule;
}

/**
 * Checks the readiness of a specific LLM platform tab.
 * This now also passes the config to the content script for initialization.
 */
export async function check({ providerKey }) {
  const config = getProviderConfig(providerKey);
  const tab = findTabByPlatform(providerKey);
  
  if (!tab) {
    return { status: 'TAB_NOT_OPEN', message: `${config.name || providerKey} tab is not open.`, data: { url: config.url } };
  }

  try {
    // **THE KEY CHANGE:** We now pass the config in the payload.
    // The content script will use this to initialize its Provider instance.
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: CHECK_READINESS,
      payload: { config }
    });
    
    // The response object from the content script now contains the status.
    if (!response.success) {
      throw new Error(response.error);
    }
    
    return { status: response.status, message: response.message, data: { tabId: tab.id } };

  } catch (error) {
    console.error(`[Handler:CheckReadiness] Error checking readiness for ${providerKey}:`, error);
    // Handle case where content script might not be injected yet
    if (error.message.includes("Could not establish connection")) {
      return { status: 'TAB_NOT_READY', message: 'Tab is still loading. Please wait and try again.', data: { url: config.url } };
    }
    throw new Error(`Failed to check readiness for ${providerKey}: ${error.message}`);
  }
}