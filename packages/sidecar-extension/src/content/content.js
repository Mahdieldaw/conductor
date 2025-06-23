// packages/sidecar-extension/src/content/content.js
import { Provider } from './provider.js';

(function() {
  // Initialization guard to prevent script from running multiple times
  if (window.hybridHasInitialized) return;
  window.hybridHasInitialized = true;

  console.log('[Sidecar] Content script initializing...');
  
  let provider = null;

  // This is the single, unified listener for ALL commands from the service worker.
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, payload } = message;

    // A simple health check to confirm the content script is alive and listening.
    if (type === 'HEALTH_CHECK') {
      sendResponse({ healthy: true, providerInitialized: !!provider });
      return;
    }
    
    // The CHECK_READINESS action is special: it creates the provider instance.
    if (type === 'CHECK_READINESS') {
      try {
        provider = new Provider(payload.config); // Pass the config from SW
        // Expose for debugging
        window.sidecar = provider;
        provider.checkReadiness().then(sendResponse);
      } catch (e) {
        sendResponse({ success: false, error: e.message, status: 'ERROR' });
      }
      return true; // Indicates an async response
    }

    // For all subsequent actions, we must ensure the provider was initialized.
    if (!provider) {
      const errorMsg = 'Provider not initialized. A readiness check must be performed first.';
      console.error(`[Sidecar] ${errorMsg}`);
      sendResponse({ success: false, error: errorMsg });
      return;
    }

    // Route other actions to the provider instance.
    switch (type) {
      case 'START_NEW_CHAT':
        provider.startNewChat().then(sendResponse);
        break;
      case 'BROADCAST_PROMPT':
        provider.broadcast(payload.prompt).then(sendResponse);
        break;
      case 'HARVEST_RESPONSE':
        provider.harvest().then(sendResponse);
        break;
      default:
        sendResponse({ success: false, error: `Unknown message type received: ${type}` });
    }

    return true; // Keep channel open for async responses
  });

})();