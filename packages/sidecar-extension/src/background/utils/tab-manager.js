// packages/sidecar-extension/src/background/tab-manager.js

// This loads all provider configs at once, creating a map of hostnames to provider keys.
const providerToHostnamesMap = new Map();
const hostnameToProviderMap = new Map();
let configsLoaded = false;

async function loadConfigs() {
  if (configsLoaded) return;
  
  try {
    const configNames = ['chatgpt', 'claude'];
    const configs = {};
    
    for (const name of configNames) {
      const url = chrome.runtime.getURL(`content/configs/${name}.json`);
      const response = await fetch(url);
      configs[name] = await response.json();
    }
    
    for (const [providerKey, config] of Object.entries(configs)) {
      if (config.providerKey && Array.isArray(config.hostnames)) {
        providerToHostnamesMap.set(config.providerKey, config.hostnames);
        for (const hostname of config.hostnames) {
          hostnameToProviderMap.set(hostname, config.providerKey);
        }
      }
    }
    
    configsLoaded = true;
    console.log('[TabManager] Initialized with provider->hostnames mapping:', providerToHostnamesMap);
  } catch (error) {
    console.error('[TabManager] Failed to load configs:', error);
  }
}

// Initialize configs
loadConfigs();

/**
 * Ensures configs are loaded before proceeding
 */
async function ensureConfigsLoaded() {
  await loadConfigs();
}

/**
 * Stateless utility functions for tab management.
 * Performs fresh, live queries every time to eliminate race conditions.
 */

/**
 * Finds a tab by provider key using a fresh query.
 * @param {string} providerKey - The provider key to search for
 * @returns {Promise<Object|undefined>} Tab object or undefined if not found
 */
export async function findTabByProviderKey(providerKey) {
  const hostnames = providerToHostnamesMap.get(providerKey);
  if (!hostnames || hostnames.length === 0) {
    console.warn(`[TabManager] No hostnames configured for provider: ${providerKey}`);
    return undefined;
  }

  // Build the URL patterns for the query
  const urlPatterns = hostnames.map(h => `*://${h}/*`);
  
  try {
    // Query for all tabs that match the hostnames for the given platform
    const matchingTabs = await chrome.tabs.query({ url: urlPatterns });

    if (matchingTabs.length === 0) {
      console.warn(`[TabManager] No tab found for provider: ${providerKey}`);
      return undefined;
    }

    // Sort by last active tab (if available in tab object) or return the last one in the array
    matchingTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    
    const bestTab = matchingTabs[0];
    console.log(`[TabManager] Found tab ${bestTab.id} for provider '${providerKey}'`);
    
    // Return a consistent tab object format
    const hostname = new URL(bestTab.url).hostname;
    return {
      url: bestTab.url,
      hostname,
      providerKey,
      tabId: bestTab.id,
      lastActivity: Date.now()
    };
  } catch (error) {
    console.error(`[TabManager] Error querying tabs for provider ${providerKey}:`, error);
    return undefined;
  }
}

/**
 * Finds a ready tab by provider with responsiveness verification.
 * @param {string} providerKey - The provider key to search for
 * @returns {Promise<Object|undefined>} Tab object or undefined if not found/ready
 */
export async function findReadyTabByProviderKey(providerKey) {
  const tab = await findTabByProviderKey(providerKey);
  if (!tab) return undefined;
  
  // Verify tab is still responsive
  try {
    await chrome.tabs.sendMessage(tab.tabId, { type: 'PING' });
    console.log(`[TabManager] Verified tab ${tab.tabId} is ready for provider '${providerKey}'`);
    return tab;
  } catch (error) {
    console.warn(`[TabManager] Tab ${tab.tabId} not responsive for provider '${providerKey}', finding alternative...`);
    
    // Try to find another tab for the same provider
    const hostnames = providerToHostnamesMap.get(providerKey);
    if (hostnames && hostnames.length > 0) {
      const urlPatterns = hostnames.map(h => `*://${h}/*`);
      try {
        const matchingTabs = await chrome.tabs.query({ url: urlPatterns });
        
        // Try other tabs for the same provider
        for (const altTab of matchingTabs) {
          if (altTab.id !== tab.tabId) {
            try {
              await chrome.tabs.sendMessage(altTab.id, { type: 'PING' });
              const hostname = new URL(altTab.url).hostname;
              console.log(`[TabManager] Found alternative ready tab ${altTab.id} for provider '${providerKey}'`);
              return {
                url: altTab.url,
                hostname,
                providerKey,
                tabId: altTab.id,
                lastActivity: Date.now()
              };
            } catch (e) {
              // This tab is also not responsive, continue
            }
          }
        }
      } catch (e) {
        console.error(`[TabManager] Error finding alternative tabs for provider ${providerKey}:`, e);
      }
    }
    
    return undefined;
  }
}

/**
 * Gets all tabs matching supported providers.
 * Note: This performs a fresh query each time to avoid stale data.
 * @returns {Promise<Array<object>>} An array of all matching tab objects.
 */
export async function getAllTabs() {
  await ensureConfigsLoaded();
  
  try {
    const allTabs = await chrome.tabs.query({});
    const supportedTabs = [];
    
    for (const tab of allTabs) {
      if (tab.url) {
        try {
          const hostname = new URL(tab.url).hostname;
          const providerKey = getProviderKeyFromHostname(hostname);
          if (providerKey) {
            supportedTabs.push({
              url: tab.url,
              hostname,
              providerKey,
              tabId: tab.id,
              lastActivity: Date.now()
            });
          }
        } catch (e) {
          // Ignore invalid URLs
        }
      }
    }
    
    return supportedTabs;
  } catch (error) {
    console.error('[TabManager] Error getting all tabs:', error);
    return [];
  }
}

/**
 * Gets the provider key for a given hostname.
 * @param {string} hostname - The hostname to look up
 * @returns {string|undefined} Provider key or undefined if not found
 */
export function getProviderKeyFromHostname(hostname) {
  return hostnameToProviderMap.get(hostname);
}

// For backward compatibility, export an object with the same interface
export const tabManager = {
  findTabByProviderKey,
  findReadyTabByProviderKey,
  getAllTabs,
  getProviderKeyFromHostname
};

// Legacy function names for backward compatibility
export const findTabByPlatform = findTabByProviderKey;
export const findReadyTabByPlatform = findReadyTabByProviderKey;
export const getPlatformKey = getProviderKeyFromHostname;
