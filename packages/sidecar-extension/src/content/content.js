import {
  CHECK_READINESS,
  START_NEW_CHAT,
  BROADCAST_PROMPT,
  HARVEST_RESPONSE,
} from '@hybrid-thinking/messaging';
import { Provider } from './provider.js';

// --- START: NEW INITIALIZATION GUARD ---
// This ensures the listener is only attached once per page context.
if (!window.hybridHasInitialized) {
  window.hybridHasInitialized = true;
  // --- END: NEW INITIALIZATION GUARD ---

  console.log('[Sidecar] Content script initializing...');
  
  let provider = null;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // This listener handles ALL commands from the service worker.
    const { type, payload } = message;

    // Health check endpoint
    if (type === 'HEALTH_CHECK') {
      sendResponse({ 
        healthy: true, 
        timestamp: Date.now(),
        providerInitialized: !!provider,
        pageUrl: window.location.href
      });
      return;
    }

    // The CHECK_READINESS action is special: it creates the provider instance.
    if (type === CHECK_READINESS) {
      try {
        // We create a new provider instance every time readiness is checked,
        // to ensure we have the latest config.
        provider = new Provider(payload.config);
        window.provider = provider; // For debugging
        console.log('[Sidecar] Provider instance created for readiness check:', provider.config.platformKey);
        provider.checkReadiness().then(sendResponse).catch(e => {
          console.error('[Sidecar] Readiness check failed:', e);
          sendResponse({ success: false, status: 'SERVICE_ERROR', error: e.message });
        });
      } catch (e) {
        console.error('[Sidecar] Failed to initialize provider for readiness check:', e);
        sendResponse({ success: false, status: 'SERVICE_ERROR', error: e.message });
      }
      return true; // async
    }

    // For all other actions, we first check if the provider was initialized.
    if (!provider) {
      const errorMsg = 'Provider not initialized. A CHECK_READINESS call must be made first.';
      console.error(`[Sidecar] ${errorMsg}`);
      sendResponse({ success: false, error: errorMsg });
      return;
    }

    // Handle different message types
    switch (type) {
      case START_NEW_CHAT:
        provider.startNewChat()
          .then(result => sendResponse({ success: true, result }))
          .catch(error => {
            console.error('[Sidecar] Start new chat failed:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // async

      case BROADCAST_PROMPT:
        provider.broadcast(payload.prompt)
          .then(result => sendResponse({ success: true, result }))
          .catch(error => {
            console.error('[Sidecar] Broadcast failed:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // async

      case HARVEST_RESPONSE:
        provider.harvest()
          .then(result => sendResponse({ success: true, result }))
          .catch(error => {
            console.error('[Sidecar] Harvest failed:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // async

      default:
        console.warn('[Sidecar] Unknown message type:', type);
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  });

  // Connection monitoring
  chrome.runtime.connect({ name: 'content-script' });
  console.log('[Sidecar] Content script connected to background.');
}