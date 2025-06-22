// Simplified readiness check using direct script execution
// This replaces the complex content script communication with a direct approach

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

/**
 * Execute readiness check using direct script injection
 * This is much simpler and more reliable than content script messaging
 */
async function executeReadinessCheck(tabId, config) {
  try {
    console.log(`[Check] Executing readiness check for tab ${tabId}`);
    
    // Execute the readiness check directly in the tab
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (config) => {
        // This function runs in the context of the target tab
        try {
          // Check if our readiness detector is available
          if (!window.hybrid || typeof window.hybrid.checkReadiness !== 'function') {
            return {
              success: false,
              status: 'SERVICE_ERROR',
              error: 'Readiness detector not available. Please refresh the page.'
            };
          }
          
          // Call the readiness check function
          return window.hybrid.checkReadiness(config);
          
        } catch (error) {
          return {
            success: false,
            status: 'SERVICE_ERROR',
            error: `Readiness check execution failed: ${error.message}`
          };
        }
      },
      args: [config]
    });
    
    // Extract the result from the execution
    const result = results[0]?.result;
    
    if (!result) {
      throw new Error('No result returned from readiness check execution');
    }
    
    console.log(`[Check] Readiness check completed:`, result);
    return result;
    
  } catch (error) {
    console.error(`[Check] Script execution failed for tab ${tabId}:`, error);
    
    // Return a structured error response
    return {
      success: false,
      status: 'TAB_NOT_READY',
      error: `Failed to execute readiness check: ${error.message}`
    };
  }
}

/**
 * Main readiness check function
 * Simplified architecture: find tab -> execute check -> return result
 */
export async function check({ providerKey }) {
  try {
    // Load provider configuration
    const config = await getProviderConfig(providerKey);
    
    // Find the target tab
    const tab = await findTabByPlatform(providerKey);
    
    if (!tab || typeof tab.tabId !== 'number') {
      return {
        status: 'TAB_NOT_OPEN',
        message: `${config.name} tab not found. Please open ${config.name} in a browser tab.`,
        data: { url: config.url }
      };
    }
    
    // Execute the readiness check
    const result = await executeReadinessCheck(tab.tabId, config);
    
    // Handle the result
    if (result.success) {
      return {
        status: result.status,
        message: result.message,
        data: { tabId: tab.tabId }
      };
    } else {
      return {
        status: result.status || 'SERVICE_ERROR',
        message: result.error || 'Readiness check failed',
        data: { url: config.url, tabId: tab.tabId }
      };
    }
    
  } catch (error) {
    console.error(`[Check] Readiness check failed for ${providerKey}:`, error);
    
    return {
      status: 'SERVICE_ERROR',
      message: `Readiness check failed: ${error.message}`,
      data: { providerKey }
    };
  }
}