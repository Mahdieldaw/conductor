// packages/sidecar-extension/src/background/service-worker.js
import { tabManager } from './tab-manager.js';
import { tabSessionManager } from './tab-session-manager.js';
import {
  EXECUTE_PROMPT,
  HARVEST_RESPONSE,
  BROADCAST_PROMPT,
  GET_AVAILABLE_TABS,
  RESET_SESSION,
  PING
} from '@hybrid-thinking/messaging';

// These modules are now deferred as they are not part of the MVP Resilient Prompting Engine
// import { IntentService } from './intent-service.js';
// import { WorkflowRunner } from './workflow-runner.js';

// --- Message Listener ---
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  const handleAsync = async () => {
    try {
      console.log(`[Service Worker] Received message: ${message.type}`, message.payload || '');
      switch (message.type) {
        case PING:
          sendResponse({ success: true, data: 'pong' });
          break;
        
        case GET_AVAILABLE_TABS:
          const tabs = tabManager.getAllTabs();
          sendResponse({ success: true, data: tabs });
          break;

        case RESET_SESSION:
          const { platform: platformToReset } = message.payload;
          const tabToReset = tabManager.findTabByPlatform(platformToReset);
          if (!tabToReset) {
            throw new Error(`No active tab for platform: ${platformToReset}`);
          }
          const newSessionId = await tabSessionManager.resetSession(tabToReset.tabId);
          sendResponse({ success: true, data: { newSessionId } });
          break;

        case EXECUTE_PROMPT:
          const result = await handleExecutePrompt(message.payload);
          sendResponse({ success: true, data: result });
          break;

        // The following are maintained for the test-harness but not primary MVP features.
        case BROADCAST_PROMPT:
          const broadcastResult = await handleBroadcastPrompt(message.payload);
          sendResponse({ success: true, data: broadcastResult });
          break;
        case HARVEST_RESPONSE:
          const harvestResult = await handleHarvestResponse(message.payload);
          sendResponse({ success: true, data: harvestResult });
          break;

        default:
          sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
      }
    } catch (error) {
      console.error('[Service Worker] Error:', error);
      sendResponse({ success: false, error: error.message });
    }
  };
  handleAsync();
  return true; // Keep the message channel open for async response
});

// --- Core Handlers ---

async function handleExecutePrompt({ platform, prompt, sessionId }) {
  const targetTab = tabManager.findTabByPlatform(platform);
  if (!targetTab) {
    throw new Error(`No active tab for platform: ${platform}`);
  }

  // MVP Note: The sessionId from the UI is advisory.
  // The core logic doesn't currently use it for validation but could in the future.
  const currentSessionId = await tabSessionManager.getSession(targetTab.tabId);
  console.log(`[Service Worker] Executing prompt on platform ${platform} with session ${currentSessionId}`);

  // 1. Broadcast
  await handleBroadcastPrompt({ platform, prompt });

  // 2. Harvest
  return await handleHarvestResponse({ platform });
}

// REVISED broadcast handler
async function handleBroadcastPrompt({ platform, prompt }) {
  const targetTab = tabManager.findTabByPlatform(platform);
  if (!targetTab) throw new Error(`Broadcast failed: No active tab for platform: ${platform}`);

  const [scriptResult] = await chrome.scripting.executeScript({
    target: { tabId: targetTab.tabId },
    func: (p) => window.sidecar.broadcast(p),
    args: [prompt],
  });

  if (scriptResult.error) throw new Error(scriptResult.error.message);
  
  const normalizedResponse = scriptResult.result;
  if (normalizedResponse?.success === false) {
    throw new Error(`Broadcast failed: ${normalizedResponse.error}`);
  }

  // If we get here, it succeeded.
  return "Prompt broadcasted successfully.";
}

// REVISED harvest handler
async function handleHarvestResponse({ platform }) {
  const targetTab = tabManager.findTabByPlatform(platform);
  if (!targetTab) throw new Error(`Harvest failed: No active tab for platform: ${platform}`);

  const [scriptResult] = await chrome.scripting.executeScript({
    target: { tabId: targetTab.tabId },
    func: () => window.sidecar.harvest(),
  });

  if (scriptResult.error) throw new Error(`Content script error during harvest: ${scriptResult.error.message}`);
  
  const normalizedResponse = scriptResult.result;
  if (normalizedResponse?.success) {
    return normalizedResponse.data;
  } else {
    throw new Error(normalizedResponse?.error || "An unknown harvest error occurred.");
  }
}

console.log('Hybrid Thinking OS Sidecar - Resilient Service Worker loaded.');