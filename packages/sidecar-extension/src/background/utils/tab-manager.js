// packages/sidecar-extension/src/background/tab-manager.js

// This loads all provider configs at once, creating a map of hostnames to platform keys.
const configs = import.meta.glob('/src/content/configs/*.json', { eager: true });
const hostnameToPlatformMap = new Map();

for (const path in configs) {
  const config = configs[path].default || configs[path];
  if (config.platformKey && Array.isArray(config.hostnames)) {
    for (const hostname of config.hostnames) {
      hostnameToPlatformMap.set(hostname, config.platformKey);
    }
  }
}
console.log('[TabManager] Initialized with hostname mapping:', hostnameToPlatformMap);

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
  
  // This is now the primary method to get a tab, handling the async query internally.
  async findTabByPlatform(platformKey) {
    // First, try to find a recently active tab from our cache.
    let candidates = [];
    for (const tab of this.tabs.values()) {
        if (tab.platformKey === platformKey) {
            candidates.push(tab);
        }
    }
    
    // Sort by last activity to get the most recent one.
    if (candidates.length > 0) {
        candidates.sort((a, b) => b.lastActivity - a.lastActivity);
        const mostRecentCachedTab = candidates[0];
        
        // Quick verification check to see if the tab still exists.
        try {
            await chrome.tabs.get(mostRecentCachedTab.tabId);
            return mostRecentCachedTab; // Return from cache if it's still valid
        } catch (e) {
            // The tab was closed, remove it from our cache.
            this.tabs.delete(mostRecentCachedTab.tabId);
        }
    }
    
    // If no valid tab was found in cache, query all tabs.
    console.log(`[TabManager] No valid tab in cache for '${platformKey}'. Performing a full query.`);
    const allTabs = await chrome.tabs.query({ url: `*://${platformKey === 'chatgpt' ? 'chat.openai.com' : 'claude.ai'}/*` });
    
    if (allTabs.length === 0) {
        console.warn(`[TabManager] No tab found for platform: ${platformKey}`);
        return undefined;
    }
    
    // Update our cache with the newly found tabs
    allTabs.forEach(tab => this.addOrUpdateTab(tab.id, tab.url));

    // Return the first one found from the live query.
    return this.tabs.get(allTabs[0].id);
  }

  getPlatformKey(hostname) {
    if (hostname.includes('chat.openai.com')) return 'chatgpt';
    if (hostname.includes('claude.ai')) return 'claude';
    return null;
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
