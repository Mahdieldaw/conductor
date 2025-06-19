// src/background/service-worker.js

// Tab Registry to track open LLM tabs
class TabRegistry {
  constructor() {
    this.tabs = new Map();
  }

  addTab(tabId, url) {
    const hostname = new URL(url).hostname;
    if (this.isSupportedHostname(hostname)) {
      // THE FIX: getPlatformKey is already correct. No more .toLowerCase() needed.
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
    if (!hostname) return 'unknown';
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
    // THE FIX: Remove the internal conversion. Trust the caller to provide a clean key.
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
      switch (message.type) {
        case 'EXECUTE_PROMPT':
          const result = await handleExecutePrompt(message.payload);
          sendResponse({ success: true, data: result });
          break;
        
        case 'HARVEST_RESPONSE':
          const harvestResult = await handleHarvestResponse(message.payload);
          sendResponse({ success: true, data: harvestResult });
          break;
          
        case 'BROADCAST_PROMPT':
          const broadcastResult = await handleBroadcastPrompt(message.payload);
          sendResponse({ success: true, data: broadcastResult });
          break;

        case 'GET_AVAILABLE_TABS':
          const tabs = tabRegistry.getAllTabs();
          sendResponse({ success: true, data: tabs });
          break;
          
        case 'PING':
          sendResponse({ success: true, data: 'pong' });
          break;
          
        default:
          sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
      }
    } catch (error) {
      console.error('Sidecar Error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  handleAsync();
  return true; // Keep the message channel open for async response
});

// This function remains the "atomic" one for executing a prompt and harvesting the result.
async function handleExecutePrompt({ prompt, platform }) {
  const platformKey = platform.toLowerCase();
  const targetTab = tabRegistry.findTabByPlatform(platformKey);
  if (!targetTab) {
    throw new Error(`No active tab for platform: ${platform}`);
  }

  // 1. Broadcast
  await chrome.scripting.executeScript({
    target: { tabId: targetTab.tabId },
    func: (p) => window.sidecar.broadcast(p),
    args: [prompt],
  });

  // 2. Harvest
  console.log(`[Service Worker] Initiating harvest for ${platformKey}...`);

  const results = await chrome.scripting.executeScript({
    target: { tabId: targetTab.tabId },
    func: () => window.sidecar.harvest(),
  });

  if (!results || results.length === 0) {
    throw new Error("Script execution failed to return a result object.");
  }

  const [firstResult] = results;

  if (firstResult.error) {
    throw new Error(`Content script unhandled error: ${firstResult.error.message}`);
  }

  const normalizedResponse = firstResult.result;

  if (normalizedResponse && normalizedResponse.success) {
    console.log(`[Service Worker] ✅ Harvest successful for ${platformKey}. Method: ${normalizedResponse.meta.method}, Duration: ${normalizedResponse.meta.duration.toFixed(0)}ms`);
    return normalizedResponse.data;
  } else {
    console.error(`[Service Worker] ❌ Harvest failed for ${platformKey}. Method: ${normalizedResponse.meta.method}, Error: ${normalizedResponse.error}`);
    throw new Error(normalizedResponse.error || "An unknown harvest error occurred.");
  }
}

// This new function handles harvesting a response independently.
async function handleHarvestResponse({ platform }) {
  if (!platform) {
    throw new Error("Payload must include 'platform'.");
  }
  // THE FIX: Convert to lowercase here, and ONLY here.
  const platformKey = platform.toLowerCase();
  const targetTab = tabRegistry.findTabByPlatform(platformKey);
  if (!targetTab) {
    throw new Error(`No active tab for platform: ${platform}`);
  }
  const results = await chrome.scripting.executeScript({
    target: { tabId: targetTab.tabId },
    func: () => window.sidecar.harvest(),
  });
  if (!results || !results[0]) throw new Error('Script execution failed.');
  if (results[0].error) throw new Error(`Content script error: ${results[0].error.message}`);
  if (results[0].result === null || results[0].result === undefined) throw new Error('Content script returned null/undefined.');
  return results[0].result;
}

// Add the new handler function:
async function handleBroadcastPrompt({ prompt, platform }) {
  if (!platform) {
    throw new Error("Payload must include 'platform'.");
  }
  const platformKey = platform.toLowerCase();
  const targetTab = tabRegistry.findTabByPlatform(platformKey);
  if (!targetTab) {
    throw new Error(`No active tab for platform: ${platform}`);
  }
  const results = await chrome.scripting.executeScript({
    target: { tabId: targetTab.tabId },
    func: (promptToBroadcast) => window.sidecar.broadcast(promptToBroadcast),
    args: [prompt]
  });
  if (!results || !results[0]) throw new Error('Script execution failed for broadcast.');
  if (results[0].error) throw new Error(`Content script error during broadcast: ${results[0].error.message}`);
  return "Prompt broadcasted successfully.";
}

console.log('Hybrid Thinking OS Sidecar Extension - Service Worker loaded and ready.');