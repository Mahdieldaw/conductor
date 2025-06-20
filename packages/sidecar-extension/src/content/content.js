import { provider } from './provider.js';
import { START_NEW_CHAT } from '@hybrid-thinking/messaging';

// The ONLY job of this file is to expose the provider's methods to the window,
// but ONLY if a valid provider instance was created for this page.
if (provider) {
    try {
        // Expose functions for scripting execution (e.g., from service-worker)
        window.sidecar = {
            broadcast: (prompt) => provider.broadcast(prompt),
            harvest: () => provider.harvest(),
            // Expose the new function
            startNewChat: () => provider.startNewChat(),
        };

        // Listen for messages from the service worker (e.g., session management)
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === START_NEW_CHAT) {
                console.log('[Sidecar Content] Received START_NEW_CHAT request.');
                provider.startNewChat().then(sendResponse);
                return true; // Indicates an async response.
            }
        });

        console.log(`[Sidecar] Unified content script initialized for platform: ${provider.config.platformKey}`);
    } catch (error) {
        console.error('[Sidecar] Error attaching provider to window:', error);
    }
} else {
    // This is the expected outcome on non-LLM pages (e.g., google.com)
    // and does not indicate an error.
    console.log(`[Sidecar] No provider for this page. Sidecar is idle.`);
}