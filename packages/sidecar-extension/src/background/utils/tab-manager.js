// packages/sidecar-extension/src/background/tab-manager.js

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
    console.log('[TabManager] Initializing...');
    chrome.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this));
    
    // Perform the initial scan
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
    
    console.log('[TabManager] Initialization complete. Current tabs:', this.tabs);
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

  isSupportedHostname(hostname) {
    return hostname.includes('chatgpt.com') ||
           hostname.includes('chat.openai.com') ||
           hostname.includes('claude.ai') ||
           hostname.includes('console.anthropic.com');
  }

  getPlatformKey(hostname) {
    if (!hostname) return null;
    if (hostname.includes('chatgpt') || hostname.includes('openai')) return 'chatgpt';
    if (hostname.includes('claude') || hostname.includes('anthropic')) return 'claude';
    return null;
  }

  addOrUpdateTab(tabId, url) {
    try {
      const hostname = new URL(url).hostname;
      const platformKey = this.getPlatformKey(hostname);
      if (platformKey) {
        this.tabs.set(tabId, { url, hostname, platformKey, tabId, lastActivity: Date.now() });
        console.log(`[TabManager] Added/Updated tab ${tabId} for platform ${platformKey}`);
      }
    } catch (e) {
      console.warn(`[TabManager] Could not process tab URL: ${url}`, e);
    }
  }

  findTabByPlatform(platformKey) {
    // Return the most recently active tab if multiple are open.
    let latestTab = null;
    for (const info of this.tabs.values()) {
      if (info.platformKey === platformKey) {
        if (!latestTab || info.lastActivity > latestTab.lastActivity) {
            latestTab = info;
        }
      }
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
