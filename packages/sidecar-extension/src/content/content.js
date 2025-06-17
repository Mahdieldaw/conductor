// src/content/content.js
import { ProviderFactory } from './providers/ProviderFactory.js';
import { ContentStateDetector } from './primitives/ContentStateDetector.js';

// Initialize the content state detector
const stateDetector = new ContentStateDetector();

// Create the sidecar API object that will be exposed to the service worker
const sidecarAPI = {
  /**
   * Broadcast a prompt to the current LLM interface
   * @param {string} prompt - The prompt to send
   * @returns {Promise<string>} - Success message
   */
  async broadcast(prompt) {
    const hostname = window.location.hostname; // <-- FIX: Get hostname from window context
    try {
      console.log(`[Sidecar] Broadcasting prompt to ${hostname}:`, prompt);
      
      // Use the ProviderFactory to send the prompt
      await ProviderFactory.broadcast(hostname, prompt);
      
      console.log(`[Sidecar] Prompt successfully broadcast to ${hostname}`);
      return 'Prompt sent successfully';
    } catch (error) {
      console.error(`[Sidecar] Error broadcasting prompt:`, error);
      throw new Error(`Failed to broadcast prompt: ${error.message}`);
    }
  },

  /**
   * Harvest the response from the current LLM interface
   * @returns {Promise<string>} - The harvested response
   */
  async harvest() {
    const hostname = window.location.hostname; // <-- FIX: Get hostname from window context
    try {
      console.log(`[Sidecar] Harvesting response from ${hostname}`);
      
      // Wait for the response to complete and then harvest it
      const response = await stateDetector.harvest(hostname);
      
      console.log(`[Sidecar] Response successfully harvested from ${hostname}`);
      return response;
    } catch (error) {
      console.error(`[Sidecar] Error harvesting response:`, error);
      throw new Error(`Failed to harvest response: ${error.message}`);
    }
  },

  /**
   * Check if the current page is supported
   * @param {string} hostname - The hostname to check
   * @returns {boolean} - Whether the hostname is supported
   */
  isSupported(hostname) {
    try {
      ProviderFactory.getProvider(hostname);
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Get the current page information
   * @returns {object} - Page information
   */
  getPageInfo() {
    return {
      hostname: window.location.hostname,
      url: window.location.href,
      title: document.title,
      supported: this.isSupported(window.location.hostname)
    };
  }
};

// Expose the sidecar API to the global window object
// This allows the service worker to call these methods via executeScript
window.sidecar = sidecarAPI;

// Initialize and log that the content script is ready
function initialize() {
  const hostname = window.location.hostname;
  const isSupported = sidecarAPI.isSupported(hostname);
  
  console.log(`[Sidecar] Content script initialized on ${hostname}`);
  console.log(`[Sidecar] Page supported: ${isSupported}`);
  
  if (isSupported) {
    console.log(`[Sidecar] Ready to receive commands for ${hostname}`);
  } else {
    console.warn(`[Sidecar] Unsupported hostname: ${hostname}`);
  }
}

// Wait for the page to be fully loaded before initializing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Also initialize when the page URL changes (for SPAs)
let currentUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    setTimeout(initialize, 1000); // Give the SPA time to render
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

console.log('[Sidecar] Content script loaded and ready');