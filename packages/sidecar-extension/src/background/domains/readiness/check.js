import { CHECK_READINESS } from '@hybrid-thinking/messaging';
import { tabManager } from '../../utils/tab-manager.js';

const configs = import.meta.glob('/src/content/configs/*.json', { eager: true });

function getProviderConfig(providerKey) {
  const path = `/src/content/configs/${providerKey}.json`;
  const configModule = configs[path];
  if (!configModule) {
    throw new Error(`Config file not found for provider: ${providerKey}`);
  }
  return configModule.default || configModule;
}

async function injectContentModule(tabId) {
  // This check is critical. If tabId is undefined, we can't proceed.
  if (typeof tabId !== 'number') {
    throw new TypeError("Failed to inject script: tabId is not a number.");
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId }, // Use the passed tabId directly
      func: () => {
        if (window.sidecarInjected) { return; }
        window.sidecarInjected = true;
        import(chrome.runtime.getURL('content/content.js'));
      },
    });
  } catch (e) {
    console.error(`Failed to inject content script into tab ${tabId}:`, e);
    throw e;
  }
}

export async function check({ providerKey }) {
  const config = getProviderConfig(providerKey);
  const tab = await tabManager.findTabByPlatform(providerKey);
  
  if (!tab || typeof tab.tabId !== 'number') {
    return { status: 'TAB_NOT_OPEN', message: `${config.name || providerKey} tab is not open.`, data: { url: config.url } };
  }

  try {
    // THE FIX: We now explicitly pass `tab.tabId` to the injection function.
    await injectContentModule(tab.tabId);
    
    // Give the module a moment to load and attach its listener.
    await new Promise(resolve => setTimeout(resolve, 100));

    // And we use `tab.tabId` for sending the message.
    const response = await chrome.tabs.sendMessage(tab.tabId, {
      type: CHECK_READINESS,
      payload: { config }
    });
    
    if (!response || response.success === false) {
      throw new Error(response?.error || 'Content script did not respond correctly.');
    }
    
    return { status: response.status, message: response.message, data: { tabId: tab.tabId } };

  } catch (error) {
    console.error(`[Handler:CheckReadiness] Error checking readiness for ${providerKey} in tab ${tab.tabId}:`, error);
    if (error.message.includes("Could not establish connection")) {
      return { status: 'TAB_NOT_READY', message: 'Tab is still loading or not responding. Please try rechecking.', data: { url: config.url } };
    }
    throw new Error(`Failed to check readiness for ${providerKey}: ${error.message}`);
  }
}