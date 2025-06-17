import { provider } from './provider.js';

// The only job of this file is to expose the provider's methods to the window.
try {
    window.sidecar = {
        broadcast: (prompt) => provider.broadcast(prompt),
        harvest: () => provider.harvest(),
    };

    console.log(`[Sidecar] Unified content script initialized for platform: ${provider.config.platformKey}`);
} catch (error) {
    // This is expected on pages without a config.
    console.log(`[Sidecar] No configuration for this page. Sidecar is idle.`);
}