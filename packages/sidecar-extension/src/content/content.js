import {
  CHECK_READINESS,
  START_NEW_CHAT,
  BROADCAST_PROMPT,
  HARVEST_RESPONSE,
} from '@hybrid-thinking/messaging';
import { Provider } from './provider.js';

let provider = null;

console.log('[Sidecar] Unified content script loaded.');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // The CHECK_READINESS message is now special. It also initializes the provider.
  if (message.type === CHECK_READINESS) {
    if (!provider) {
      try {
        provider = new Provider(message.payload.config);
        window.provider = provider; // For debugging
        console.log('[Sidecar] Provider instance created:', provider);
      } catch (e) {
        console.error('[Sidecar] Failed to initialize provider:', e);
        sendResponse({ success: false, error: e.message });
        return;
      }
    }
    console.log('[Sidecar Content] Received CHECK_READINESS request.');
    provider.checkReadiness().then(sendResponse);
    return true; // Keep channel open for async response
  }

  // For all other messages, we must ensure the provider has been initialized.
  if (!provider) {
    const errorMsg = 'Provider not initialized. A readiness check must be performed first.';
    console.error(`[Sidecar Content] Error: ${errorMsg}`);
    sendResponse({ success: false, error: errorMsg });
    return;
  }

  if (message.type === START_NEW_CHAT) {
    console.log('[Sidecar Content] Received START_NEW_CHAT request.');
    provider.startNewChat().then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (message.type === BROADCAST_PROMPT) {
    console.log('[Sidecar Content] Received BROADCAST_PROMPT request.');
    provider.broadcast(message.payload.prompt).then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (message.type === HARVEST_RESPONSE) {
    console.log('[Sidecar Content] Received HARVEST_RESPONSE request.');
    provider.harvest().then(response => sendResponse(response)).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
});