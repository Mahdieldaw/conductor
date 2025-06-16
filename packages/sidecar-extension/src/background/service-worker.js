// src/background/service-worker.js

// FIX #1: Import the individual constants directly
import { PING, EXECUTE_PROMPT, GET_AVAILABLE_TABS } from '@hybrid-thinking/messaging';

// Tab Registry to track open LLM tabs
class TabRegistry {
  constructor() {
    this.tabs = new Map();
  }

  addTab(tabId, url) {
    const hostname = new URL(url).hostname;
    // Only track supported hostnames
    if (this.isSupportedHostname(hostname)) {
      const platformKey = this.getPlatformKey(hostname);
      this.tabs.set(tabId, { url, hostname, platformKey, lastActivity: Date.now() });
      console.log(`TabRegistry: Added/Updated tab ${tabId} for platform ${platformKey}`);
    }
  }

  removeTab(tabId) {
    if (this.tabs.has(tabId)) {
      this.tabs.delete(tabId);
      console.log(`TabRegistry: Removed tab ${tabId}`);
    }
  }
  
  isSupportedHostname(hostname) {
    return hostname.includes('chatgpt.com') || 
           hostname.includes('chat.openai.com') || 
           hostname.includes('claude.ai') || 
           hostname.includes('console.anthropic.com');
  }
  
  getPlatformKey(hostname) {
    if (hostname.includes('chatgpt') || hostname.includes('openai')) return 'chatgpt';
    if (hostname.includes('claude') || hostname.includes('anthropic')) return 'claude';
    return 'unknown';
  }

  getTab(tabId) {
    return this.tabs.get(tabId);
  }

  getAllTabs() {
    return Array.from(this.tabs.entries()).map(([tabId, info]) => ({
      tabId,
      ...info
    }));
  }

  findTabByPlatform(platformKey) {
    for (const [tabId, info] of this.tabs.entries()) {
      if (info.platformKey === platformKey) {
        return { tabId, ...info };
      }
    }
    return null;
  }
}

const tabRegistry = new TabRegistry();

// Initialize registry on startup
chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
        if(tab.url) tabRegistry.addTab(tab.id, tab.url);
    });
});

// Listen for tab updates to maintain registry
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    tabRegistry.addTab(tabId, tab.url);
  }
});

// Clean up closed tabs
chrome.tabs.onRemoved.addListener((tabId) => {
  tabRegistry.removeTab(tabId);
});

// Handle messages from the web app
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  const handleAsync = async () => {
    try {
      // FIX #2: Use the constants directly instead of from an object
      switch (message.type) {
        case EXECUTE_PROMPT:
          const result = await handleExecutePrompt(message.payload);
          sendResponse({ success: true, data: result });
          break;
          
        case GET_AVAILABLE_TABS:
          const tabs = tabRegistry.getAllTabs();
          sendResponse({ success: true, data: tabs });
          break;
          
        case PING:
          sendResponse({ success: true, data: 'pong' });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Sidecar Error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  handleAsync();
  return true; // Keep the message channel open for async response
});

// Core function to execute prompts and harvest response
async function handleExecutePrompt({ prompt, platform }) {
  const targetTab = tabRegistry.findTabByPlatform(platform);
  if (!targetTab) {
    throw new Error(`No active tab found for platform: ${platform}. Please open the corresponding website.`);
  }

  const tabId = targetTab.tabId;

  // 1. Execute the broadcast function in the content script
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (promptToBroadcast) => window.sidecar.broadcast(promptToBroadcast),
    args: [prompt]
  });

  // 2. Execute the harvest function in the content script
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.sidecar.harvest(),
  });

  if (!results || results.length === 0) {
    throw new Error('Failed to execute harvest script in target tab.');
  }

  const result = results[0].result;
  if (result.error) { // The injected function itself returned an error
    throw new Error(result.error);
  }

  return result; // The final harvested content
}


console.log('Hybrid Thinking OS Sidecar Extension - Service Worker loaded and ready.');