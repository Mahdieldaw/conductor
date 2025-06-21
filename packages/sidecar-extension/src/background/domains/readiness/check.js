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
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (window.sidecarInjected) { return; }
        window.sidecarInjected = true;
        import(chrome.runtime.getURL('content/content.js'));
      },
    });
  } catch (e) {
    console.error(`Failed to inject content script into tab ${tabId}:`, e);
    // This error is critical, re-throw it so the caller can handle it.
    throw e; 
  }
}

export async function check({ providerKey }) {
  const config = getProviderConfig(providerKey);
  
  // THE FIX: We now `await` the tab finding logic, which runs an up-to-date query.
  const tab = await tabManager.findTabByPlatform(providerKey);
  
  if (!tab || !tab.tabId) {
    return { status: 'TAB_NOT_OPEN', message: `${config.name || providerKey} tab is not open.`, data: { url: config.url } };
  }

  try {
    await injectContentModule(tab.id);
    await new Promise(resolve => setTimeout(resolve, 100));

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