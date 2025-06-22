import {
  CHECK_READINESS,
  START_NEW_CHAT,
  BROADCAST_PROMPT,
  HARVEST_RESPONSE,
} from '@hybrid-thinking/messaging';
import { Provider } from './provider.js';

// --- START: NEW INITIALIZATION GUARD ---
// This ensures the listener is only attached once per page context.
if (!window.sidecarInjected) {
  window.sidecarInjected = true;
  // --- END: NEW INITIALIZATION GUARD ---

  let provider = null;

  console.log('[Sidecar] Unified content script loaded and listener attached.');

  // Add to the existing message listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Health check endpoint
    if (message.type === 'HEALTH_CHECK') {
      sendResponse({ 
        healthy: true, 
        timestamp: Date.now(),
        providerInitialized: !!provider,
        pageUrl: window.location.href
      });
      return;
    }
    
    // The CHECK_READINESS message is special. It also initializes the provider.
    if (message.type === CHECK_READINESS) {
      // Allow re-initialization on subsequent checks, in case page state changed.
      try {
        provider = new Provider(message.payload.config);
        window.provider = provider; // For debugging
        console.log('[Sidecar] Provider instance created/updated:', provider.config.platformKey);
      } catch (e) {
        console.error('[Sidecar] Failed to initialize provider:', e);
        sendResponse({ success: false, error: e.message });
        return; // Must return early
      }
      
      console.log('[Sidecar Content] Received CHECK_READINESS request.');
      provider.checkReadiness().then(sendResponse).catch(e => sendResponse({ success: false, error: e.message, status: 'SERVICE_ERROR' }));
      return true; // Keep channel open for async response
    }

    // For all other messages, we must ensure the provider has been initialized.
    if (!provider) {
      const errorMsg = 'Provider not initialized. A readiness check must be performed first.';
      console.error(`[Sidecar Content] Error: ${errorMsg}`);
      sendResponse({ success: false, error: errorMsg });
      return false;
    }

    try {
        switch (message.type) {
            case START_NEW_CHAT:
                console.log('[Sidecar Content] Received START_NEW_CHAT request.');
                provider.startNewChat().then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
                return true;
            case BROADCAST_PROMPT:
                console.log('[Sidecar Content] Received BROADCAST_PROMPT request.');
                provider.broadcast(message.payload.prompt).then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
                return true;
            case HARVEST_RESPONSE:
                console.log('[Sidecar Content] Received HARVEST_RESPONSE request.');
                provider.harvest().then(response => sendResponse(response)).catch(e => sendResponse({ success: false, error: e.message }));
                return true;
        }
    } catch (e) {
        sendResponse({ success: false, error: e.message });
        return false;
    }
  });
  
  // Add connection monitoring
  let connectionHealthy = true;
  chrome.runtime.onConnect.addListener(() => {
    connectionHealthy = true;
  });
  
  chrome.runtime.onDisconnect.addListener(() => {
    connectionHealthy = false;
    console.warn('[Sidecar] Runtime connection lost');
  });
}