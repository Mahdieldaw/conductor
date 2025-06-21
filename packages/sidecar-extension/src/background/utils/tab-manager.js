// packages/sidecar-extension/src/background/tab-manager.js

// This loads all provider configs at once, creating a map of hostnames to platform keys.
const configs = import.meta.glob('/src/content/configs/*.json', { eager: true });
const platformToHostnamesMap = new Map();
const hostnameToPlatformMap = new Map();

for (const path in configs) {
  const config = configs[path].default || configs[path];
  if (config.platformKey && Array.isArray(config.hostnames)) {
    platformToHostnamesMap.set(config.platformKey, config.hostnames);
    for (const hostname of config.hostnames) {
      hostnameToPlatformMap.set(hostname, config.platformKey);
    }
  }
}
console.log('[TabManager] Initialized with platform->hostnames mapping:', platformToHostnamesMap);

/**
 * Manages all interactions with the chrome.tabs API.
 */
class TabManager {
  constructor() {
    this.tabs = new Map();
    this.initializeListeners();
    console.log('[TabManager] Initialized and listeners attached.');
  }

  initializeListeners() {
    chrome.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this));
  }
  
  // THE DEFINITIVE FIX IS IN THIS FUNCTION
  async findTabByPlatform(platformKey) {
    const hostnames = platformToHostnamesMap.get(platformKey);
    if (!hostnames || hostnames.length === 0) {
      console.warn(`[TabManager] No hostnames configured for platform: ${platformKey}`);
      return undefined;
    }

    // Build the URL patterns for the query
    const urlPatterns = hostnames.map(h => `*://${h}/*`);
    
    // Query for all tabs that match the hostnames for the given platform
    const matchingTabs = await chrome.tabs.query({ url: urlPatterns });

    if (matchingTabs.length === 0) {
      console.warn(`[TabManager] No tab found for platform: ${platformKey}`);
      return undefined;
    }

    // Update our internal cache with all found tabs to keep it fresh
    matchingTabs.forEach(tab => this.addOrUpdateTab(tab.id, tab.url));

    // Sort by last active tab (if available in tab object) or return the last one in the array
    matchingTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    
    const bestTab = matchingTabs[0];
    console.log(`[TabManager] Found tab ${bestTab.id} for platform '${platformKey}'`);
    return this.tabs.get(bestTab.id);
  }

  getPlatformKey(hostname) {
    return hostnameToPlatformMap.get(hostname);
  }

  addOrUpdateTab(tabId, url) {
    try {
      const hostname = new URL(url).hostname;
      const platformKey = this.getPlatformKey(hostname);
      if (platformKey) {
        this.tabs.set(tabId, { url, hostname, platformKey, tabId, lastActivity: Date.now() });
      }
    } catch (e) {
      // Ignore invalid URLs
    }
  }

  handleTabUpdated(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url) {
      this.addOrUpdateTab(tabId, tab.url);
    }
  }

  handleTabRemoved(tabId) {
    if (this.tabs.has(tabId)) {
      this.tabs.delete(tabId);
      console.log(`[TabManager] Removed tab ${tabId}.`);
    }
  }
}

export const tabManager = new TabManager();
