import { provider } from './provider.js';

// The ONLY job of this file is to expose the provider's methods to the window,
// but ONLY if a valid provider instance was created for this page.
if (provider) {
    try {
        window.sidecar = {
            broadcast: (prompt) => provider.broadcast(prompt),
            harvest: () => provider.harvest(),
        };
        console.log(`[Sidecar] Unified content script initialized for platform: ${provider.config.platformKey}`);
    } catch (error) {
        console.error('[Sidecar] Error attaching provider to window:', error);
    }
} else {
    // This is the expected outcome on non-LLM pages (e.g., google.com)
    // and does not indicate an error.
    console.log(`[Sidecar] No provider for this page. Sidecar is idle.`);
}