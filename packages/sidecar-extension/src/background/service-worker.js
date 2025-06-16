// src/background/service-worker.js
import { MESSAGE_TYPES } from '@hybrid-thinking/messaging';

// Tab Registry to track open LLM tabs
class TabRegistry {
  constructor() {
    this.tabs = new Map();
  }

  addTab(tabId, url) {
    const hostname = new URL(url).hostname;
    this.tabs.set(tabId, { url, hostname, lastActivity: Date.now() });
  }

  removeTab(tabId) {
    this.tabs.delete(tabId);
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

  findTabByHostname(hostname) {
    for (const [tabId, info] of this.tabs.entries()) {
      if (info.hostname.includes(hostname)) {
        return { tabId, ...info };
      }
    }
    return null;
  }
}

const tabRegistry = new TabRegistry();

// Listen for tab updates to maintain registry
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const hostname = new URL(tab.url).hostname;
    // Only track LLM websites
    if (hostname.includes('chatgpt.com') || 
        hostname.includes('chat.openai.com') || 
        hostname.includes('claude.ai') || 
        hostname.includes('console.anthropic.com')) {
      tabRegistry.addTab(tabId, tab.url);
    }
  }
});

// Clean up closed tabs
chrome.tabs.onRemoved.addListener((tabId) => {
  tabRegistry.removeTab(tabId);
});

// Handle messages from the web app
chrome.runtime.onMessageExternal.addListener(async (message, sender, sendResponse) => {
  try {
    switch (message.type) {
      case MESSAGE_TYPES.EXECUTE_PROMPT:
        const result = await handleExecutePrompt(message.payload);
        sendResponse({ success: true, data: result });
        break;
        
      case MESSAGE_TYPES.GET_AVAILABLE_TABS:
        const tabs = tabRegistry.getAllTabs();
        sendResponse({ success: true, data: tabs });
        break;
        
      case MESSAGE_TYPES.PING:
        sendResponse({ success: true, data: 'pong' });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // Keep the message channel open for async response
});

// Core function to execute prompts on LLM tabs
async function handleExecutePrompt({ prompt, targetHostname, tabId }) {
  let targetTab;
  
  if (tabId) {
    // Use specific tab if provided
    targetTab = tabRegistry.getTab(tabId);
    if (!targetTab) {
      throw new Error(`Tab ${tabId} not found in registry`);
    }
  } else if (targetHostname) {
    // Find tab by hostname
    targetTab = tabRegistry.findTabByHostname(targetHostname);
    if (!targetTab) {
      throw new Error(`No tab found for hostname: ${targetHostname}`);
    }
  } else {
    throw new Error('Either tabId or targetHostname must be provided');
  }

  // Execute the broadcast function in the content script
  const results = await chrome.scripting.executeScript({
    target: { tabId: targetTab.tabId },
    func: executeBroadcast,
    args: [prompt, targetTab.hostname]
  });

  if (!results || results.length === 0) {
    throw new Error('Failed to execute script in target tab');
  }

  const result = results[0].result;
  if (result.error) {
    throw new Error(result.error);
  }

  return result.data;
}

// Function that gets injected into the content script context
function executeBroadcast(prompt, hostname) {
  try {
    if (!window.sidecar) {
      return { error: 'Sidecar not initialized in this tab' };
    }
    
    // Call the broadcast method exposed by content.js
    return window.sidecar.broadcast(prompt, hostname)
      .then(result => ({ data: result }))
      .catch(error => ({ error: error.message }));
  } catch (error) {
    return { error: error.message };
  }
}

// Function to harvest responses
async function handleHarvestResponse({ tabId, targetHostname }) {
  let targetTab;
  
  if (tabId) {
    targetTab = tabRegistry.getTab(tabId);
    if (!targetTab) {
      throw new Error(`Tab ${tabId} not found in registry`);
    }
  } else if (targetHostname) {
    targetTab = tabRegistry.findTabByHostname(targetHostname);
    if (!targetTab) {
      throw new Error(`No tab found for hostname: ${targetHostname}`);
    }
  } else {
    throw new Error('Either tabId or targetHostname must be provided');
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: targetTab.tabId },
    func: executeHarvest,
    args: [targetTab.hostname]
  });

  if (!results || results.length === 0) {
    throw new Error('Failed to execute harvest script in target tab');
  }

  const result = results[0].result;
  if (result.error) {
    throw new Error(result.error);
  }

  return result.data;
}

// Function that gets injected to harvest responses
function executeHarvest(hostname) {
  try {
    if (!window.sidecar) {
      return { error: 'Sidecar not initialized in this tab' };
    }
    
    return window.sidecar.harvest(hostname)
      .then(result => ({ data: result }))
      .catch(error => ({ error: error.message }));
  } catch (error) {
    return { error: error.message };
  }
}

console.log('Hybrid Thinking OS Sidecar Extension - Service Worker loaded');