import { findTabByPlatform } from '../../utils/tab-manager.js';

let configs = {};
let configsLoaded = false;

/**
 * Load provider configurations
 */
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
    console.log('[Check] Provider configs loaded successfully');
  } catch (error) {
    console.error('[Check] Failed to load configs:', error);
    throw error;
  }
}

/**
 * Get configuration for a specific provider
 */
async function getProviderConfig(providerKey) {
  await loadConfigs();
  const config = configs[providerKey];
  if (!config) {
    throw new Error(`Config file not found for provider: ${providerKey}`);
  }
  return config;
}

export async function check({ providerKey }) {
    console.log(`[Readiness] Checking readiness for provider: ${providerKey}`);
    const config = await getProviderConfig(providerKey);
    if (!config) {
        return { status: 'ERROR', message: `Configuration for '${providerKey}' not found.` };
    }

    // 1. Find the tab.
    const tab = await findTabByPlatform(providerKey);
    if (!tab) {
        return { status: 'TAB_NOT_OPEN', message: `${config.name || providerKey} tab not found.`, data: { url: config.url } };
    }

    // 2. Directly execute the readiness function that our `readiness-detector.js` has placed on the window.
    try {
        const [result] = await chrome.scripting.executeScript({
            target: { tabId: tab.tabId },
            // This function runs in the context of the content script
            func: (cfg) => window.hybrid.checkReadiness(cfg),
            args: [config], // Pass the config object as an argument
        });

        if (!result || !result.result) {
            throw new Error("Readiness script did not return a valid result. The content script might be blocked or failed to initialize.");
        }
        
        const readinessStatus = result.result;
        
        // Enrich the successful 'READY' status with the tabId and session info before returning.
        if (readinessStatus.status === 'READY') {
            // Note: Session management would ideally be handled here or in the router after this check passes.
            readinessStatus.data = { tabId: tab.tabId };
        }
        
        return readinessStatus;

    } catch (err) {
        console.error(`[Readiness Check] Error executing script on tab ${tab.tabId}:`, err);
        return { status: 'ERROR', message: `Could not check readiness. The tab may be crashed or protected. (${err.message})` };
    }
}