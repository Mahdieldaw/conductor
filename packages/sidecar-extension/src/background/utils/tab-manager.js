// packages/sidecar-extension/src/background/tab-manager.js

// This loads all provider configs at once, creating a map of hostnames to platform keys.
const platformToHostnamesMap = new Map();
const hostnameToPlatformMap = new Map();
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
    
    for (const [platformKey, config] of Object.entries(configs)) {
      if (config.platformKey && Array.isArray(config.hostnames)) {
        platformToHostnamesMap.set(config.platformKey, config.hostnames);
        for (const hostname of config.hostnames) {
          hostnameToPlatformMap.set(hostname, config.platformKey);
        }
      }
    }
    
    configsLoaded = true;
    console.log('[TabManager] Initialized with platform->hostnames mapping:', platformToHostnamesMap);
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
 * Finds a tab by platform key using a fresh query.
 * @param {string} platformKey - The platform key to search for
 * @returns {Promise<Object|undefined>} Tab object or undefined if not found
 */
export async function findTabByPlatform(platformKey) {
  const hostnames = platformToHostnamesMap.get(platformKey);
  if (!hostnames || hostnames.length === 0) {
    console.warn(`[TabManager] No hostnames configured for platform: ${platformKey}`);
    return undefined;
  }

  // Build the URL patterns for the query
  const urlPatterns = hostnames.map(h => `*://${h}/*`);
  
  try {
    // Query for all tabs that match the hostnames for the given platform
    const matchingTabs = await chrome.tabs.query({ url: urlPatterns });

    if (matchingTabs.length === 0) {
      console.warn(`[TabManager] No tab found for platform: ${platformKey}`);
      return undefined;
    }

    // Sort by last active tab (if available in tab object) or return the last one in the array
    matchingTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    
    const bestTab = matchingTabs[0];
    console.log(`[TabManager] Found tab ${bestTab.id} for platform '${platformKey}'`);
    
    // Return a consistent tab object format
    const hostname = new URL(bestTab.url).hostname;
    return {
      url: bestTab.url,
      hostname,
      platformKey,
      tabId: bestTab.id,
      lastActivity: Date.now()
    };
  } catch (error) {
    console.error(`[TabManager] Error querying tabs for platform ${platformKey}:`, error);
    return undefined;
  }
}

/**
 * Gets all tabs matching supported platforms.
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
          const platformKey = getPlatformKey(hostname);
          if (platformKey) {
            supportedTabs.push({
              url: tab.url,
              hostname,
              platformKey,
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
 * Gets the platform key for a given hostname.
 * @param {string} hostname - The hostname to look up
 * @returns {string|undefined} Platform key or undefined if not found
 */
export function getPlatformKey(hostname) {
  return hostnameToPlatformMap.get(hostname);
}

// For backward compatibility, export an object with the same interface
export const tabManager = {
  findTabByPlatform,
  getAllTabs,
  getPlatformKey
};
