import {
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
    
    // Initialize provider on first message if not already done
    if (!provider && message.payload?.config) {
      try {
        provider = new Provider(message.payload.config);
        window.provider = provider; // For debugging
        console.log('[Sidecar] Provider instance created:', provider.config.platformKey);
      } catch (e) {
        console.error('[Sidecar] Failed to initialize provider:', e);
        sendResponse({ success: false, error: e.message });
        return;
      }
    }

    // Ensure provider is initialized for all operations
    if (!provider) {
      const errorMsg = 'Provider not initialized. Please ensure configuration is provided.';
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