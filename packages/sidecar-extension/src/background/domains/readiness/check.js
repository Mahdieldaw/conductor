import { findTabByPlatform } from '../../utils/tab-manager.js';
import { INJECTION_CONFIG } from '../../config/injection-config.js';

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

/**
 * Wait for the content script to be loaded and window.hybrid.checkReadiness to be available
 * @param {number} tabId - The tab ID to check
 * @returns {Promise<void>}
 */
async function waitForContentScript(tabId) {
    const maxRetries = INJECTION_CONFIG.MAX_RETRIES;
    const baseTimeout = INJECTION_CONFIG.BASE_TIMEOUT;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const [result] = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    // Check if readiness detector is fully initialized
                    return !!(window.hybrid && window.hybrid.checkReadiness && window.hybrid.isReady);
                }
            });
            
            if (result && result.result) {
                console.log(`[Readiness Check] Content script ready on tab ${tabId}`);
                return; // Content script is loaded and ready
            }
        } catch (error) {
            console.warn(`[Readiness Check] Attempt ${attempt + 1} failed to check content script:`, error.message);
        }
        
        // If content script is not available, try to inject it programmatically
        if (attempt === 0) {
            try {
                console.log(`[Readiness Check] Attempting programmatic injection on tab ${tabId}`);
                await chrome.scripting.executeScript({
                    target: { tabId },
                    files: ['content/readiness-detector.js']
                });
                console.log(`[Readiness Check] Programmatic injection completed on tab ${tabId}`);
                
                // Give the script a moment to initialize
                await new Promise(resolve => setTimeout(resolve, 500));
                continue; // Retry the check immediately
            } catch (injectionError) {
                console.warn(`[Readiness Check] Programmatic injection failed:`, injectionError.message);
            }
        }
        
        // Wait before retrying with exponential backoff
        const waitTime = baseTimeout * Math.pow(2, attempt);
        console.log(`[Readiness Check] Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    throw new Error(`Content script not available after ${maxRetries} attempts. The readiness detector may have failed to load.`);
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

    // 2. Wait for content script to load, then execute the readiness function
    try {
        // First, ensure the content script is loaded and window.hybrid.checkReadiness exists
        await waitForContentScript(tab.tabId);
        
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