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
    // A promise that resolves when the initial tab scan is complete.
    this.ready = this.initialize();
  }

  async initialize() {
    console.log('[TabManager] Starting initial tab scan...');
    chrome.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this));
    
    try {
      const allTabs = await chrome.tabs.query({});
      for (const tab of allTabs) {
        if (tab.id && tab.url) {
          this.addOrUpdateTab(tab.id, tab.url);
        }
      }
    } catch (e) {
      console.error('[TabManager] Failed to query tabs during initialization:', e);
    }
    
    console.log('[TabManager] Initialization complete.');
  }

  handleTabUpdated(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url) {
      this.addOrUpdateTab(tabId, tab.url);
    }
  }

  handleTabRemoved(tabId) {
    if (this.tabs.has(tabId)) {
      this.tabs.delete(tabId);
      console.log(`[TabManager] Removed tab ${tabId}`);
    }
  }

  // Uses the robust mapping created from your config files.
  getPlatformKey(hostname) {
    return hostnameToPlatformMap.get(hostname);
  }

  addOrUpdateTab(tabId, url) {
    try {
      const hostname = new URL(url).hostname;
      const platformKey = this.getPlatformKey(hostname);
      if (platformKey) {
        this.tabs.set(tabId, { url, hostname, platformKey, tabId, lastActivity: Date.now() });
        console.log(`[TabManager] Added/Updated tab ${tabId} for platform '${platformKey}'`);
      }
    } catch (e) {
      // This can happen for invalid URLs like 'about:blank', it's safe to ignore.
    }
  }

  findTabByPlatform(platformKey) {
    let latestTab = null;
    for (const info of this.tabs.values()) {
      if (info.platformKey === platformKey) {
        if (!latestTab || info.lastActivity > latestTab.lastActivity) {
            latestTab = info;
        }
      }
    }
    if (!latestTab) {
      console.warn(`[TabManager] findTabByPlatform: No active tab found for key '${platformKey}'`);
    }
    return latestTab;
  }

  getTabById(tabId) {
    return this.tabs.get(tabId);
  }

  getAllTabs() {
    return Array.from(this.tabs.values());
  }
}

export const tabManager = new TabManager();
