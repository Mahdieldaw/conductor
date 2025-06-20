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

// --- Port-based Listener for stateful flows (Readiness Pipeline) ---
chrome.runtime.onConnect.addListener(port => {
  console.log(`[Service Worker] Connection established for: ${port.name}`);
  if (port.name === 'readiness-pipeline') {
    port.onMessage.addListener(msg => {
      if (msg.action === 'CHECK_READINESS') {
        executeReadinessPipeline(msg.providerKey, port);
      }
      if (msg.action === 'RESET_SESSION') {
        tabSessionManager.resetSession(msg.tabId)
          .then(newSessionId => port.postMessage({
            status: 'SESSION_RESET',
            data: { newSessionId }
          }))
          .catch(error => port.postMessage({
            status: 'ERROR',
            message: error.message
          }));
      }
    });
    port.onDisconnect.addListener(() => {
      console.log('[Service Worker] Readiness pipeline port disconnected.');
    });
  }
});

// Load the provider’s JSON config (loginMarkers, readyMarkers, etc.)
async function getProviderConfig(providerKey) {
  const url = chrome.runtime.getURL(`content/configs/${providerKey}.json`);
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Config not found: ${providerKey}`);
    return resp.json();
  } catch (e) {
    console.error(`Failed to load config for ${providerKey}:`, e);
    return null;
  }
}

async function executeReadinessPipeline(providerKey, port) {
  const config = await getProviderConfig(providerKey);
  if (!config) {
    port.postMessage({
      step: 0,
      status: 'ERROR',
      message: `Configuration for '${providerKey}' not found.`
    });
    return;
  }

  // Gate 1: Tab open?
  port.postMessage({
    step: 1,
    status: 'PENDING',
    message: `Checking for open ${config.name || config.platformKey} tab…`
  });
  const tab = tabManager.findTabByPlatform(providerKey);
  if (!tab) {
    port.postMessage({
      step: 1,
      status: 'TAB_NOT_OPEN',
      message: `${config.name || config.platformKey} tab is not open.`,
      data: { url: config.url }
    });
    return;
  }

  // Gate 2: Readiness check
  port.postMessage({
    step: 2,
    status: 'PENDING',
    message: `Verifying ${config.name || config.platformKey} is ready…`
  });
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.tabId },
      func: cfg => window.hybrid.checkReadiness(cfg),
      args: [config]
    });
    const { status, message } = result.result || {};
    if (status === 'READY') {
      // Gate 3: Session ID
      port.postMessage({
        step: 3,
        status: 'PENDING',
        message: 'Fetching session ID…'
      });
      const sessionId = await tabSessionManager.getSession(tab.tabId);
      port.postMessage({
        step: 3,
        status: 'READY',
        message: 'Connection successful!',
        data: { tabId: tab.tabId, sessionId }
      });
    } else {
      // Not ready (login required, needs attention, etc.)
      port.postMessage({ step: 2, status, message, data: { url: config.url } });
    }
  } catch (err) {
    console.error('Readiness pipeline error:', err);
    port.postMessage({
      step: 2,
      status: 'ERROR',
      message: `Failed to check readiness: ${err.message}.`
    });
  }
}

console.log('Hybrid Thinking OS Sidecar - Resilient Service Worker loaded.');