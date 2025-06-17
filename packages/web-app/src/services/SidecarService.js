import { 
  PING,
  GET_AVAILABLE_TABS,
  EXECUTE_PROMPT, 
  HARVEST_RESPONSE,
  BROADCAST_PROMPT
} from '@hybrid-thinking/messaging';

// This service is a singleton that abstracts all communication with the Sidecar Extension.
// The UI components should only interact with this service, not the chrome.runtime API directly.

class SidecarService {
  #extensionId;

  constructor() {
    // In a production app, the extension ID would be baked in at build time or discovered.
    // For local dev, we will fetch it from the extension itself when the app loads.
    this.#extensionId = null;
    this.isReady = false; // Flag to indicate if we've connected to the extension
  }

  // A helper to safely send messages and handle responses.
  async #sendMessage(message) {
    if (!this.isReady || !this.#extensionId) {
      throw new Error("Sidecar Service is not connected to the extension. Ensure it's installed and the page has been reloaded.");
    }

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(this.#extensionId, message, (response) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (response && response.success) {
          return resolve(response.data);
        } else {
          return reject(new Error(response?.error || 'An unknown error occurred in the extension.'));
        }
      });
    });
  }

  // --- PUBLIC API METHODS ---

  /**
   * Pings the extension to establish a connection and get its ID.
   * This MUST be called and awaited before any other method.
   * @param {string} targetExtensionId The expected ID of the extension.
   */
  async connect(targetExtensionId) {
    return new Promise((resolve, reject) => {
        if (this.isReady) return resolve(true);

        this.#extensionId = targetExtensionId;
        
        chrome.runtime.sendMessage(this.#extensionId, { type: PING }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Sidecar Connection Error:", chrome.runtime.lastError.message);
                this.isReady = false;
                return reject(new Error("Could not connect to the Sidecar Extension. Is it installed and enabled?"));
            }
            if (response && response.success && response.data === 'pong') {
                console.log("✅ Sidecar Service successfully connected to extension:", this.#extensionId);
                this.isReady = true;
                return resolve(true);
            }
            this.isReady = false;
            return reject(new Error("Extension did not respond correctly to PING."));
        });
    });
  }
  
  /**
   * Gets a list of all detected and supported LLM tabs.
   * @returns {Promise<Array<{tabId: number, hostname: string, platformKey: string}>>} A list of available tabs.
   */
  async getAvailableTabs() {
    return this.#sendMessage({ type: GET_AVAILABLE_TABS });
  }

  /**
   * Executes the full "send and wait for response" flow on a specific platform.
   * @param {string} platform - The key for the target platform (e.g., 'chatgpt').
   * @param {string} prompt - The prompt text to send.
   * @returns {Promise<string>} The harvested response from the LLM.
   */
  async executePrompt(platform, prompt) {
    return this.#sendMessage({
      type: EXECUTE_PROMPT,
      payload: { platform, prompt },
    });
  }

  /**
   * Only sends the prompt to the LLM page without waiting for a response.
   * @param {string} platform - The key for the target platform (e.g., 'chatgpt').
   * @param {string} prompt - The prompt text to send.
   * @returns {Promise<string>} A confirmation message.
   */
  async sendPromptOnly(platform, prompt) {
    return this.#sendMessage({
        type: BROADCAST_PROMPT,
        payload: { platform, prompt }
    });
  }
  
  /**
   * Only harvests the most recent response from an LLM page.
   * @param {string} platform - The key for the target platform (e.g., 'chatgpt').
   * @returns {Promise<string>} The harvested response text.
   */
  async harvestResponse(platform) {
      return this.#sendMessage({
          type: HARVEST_RESPONSE,
          payload: { platform }
      });
  }
}

// Export a singleton instance so the whole app uses the same connection.
export const sidecarService = new SidecarService();
