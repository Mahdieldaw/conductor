// packages/sidecar-extension/src/background/tab-session-manager.js
import { tabManager } from './tab-manager.js';
import { START_NEW_CHAT } from '@hybrid-thinking/messaging';

/**
 * Manages unique, per-tab session IDs to solve the "new vs. continue" chat problem.
 */
class TabSessionManager {
  constructor() {
    console.log('[TabSessionManager] Initialized.');
  }

  /**
   * Gets the current session ID for a given tab.
   * If no session exists, it creates one.
   * @param {number} tabId
   * @returns {Promise<string>} The session ID.
   */
  async getSession(tabId) {
    const key = `session_${tabId}`;
    const result = await chrome.storage.session.get(key);
    if (result[key]) {
      return result[key];
    }
    const newSessionId = crypto.randomUUID();
    await chrome.storage.session.set({ [key]: newSessionId });
    return newSessionId;
  }

  /**
   * Resets the session for a given tab. This is a two-part operation:
   * 1. Programmatically click the "New Chat" button in the provider's UI.
   * 2. If successful, generate and store a new session ID in the backend.
   * @param {number} tabId
   * @returns {Promise<string>} The new session ID.
   */
  async resetSession(tabId) {
    const tabInfo = tabManager.getTabById(tabId);
    if (!tabInfo) {
      throw new Error(`[TabSessionManager] No tab info found for tabId: ${tabId}`);
    }

    // Step 1: Command the content script to click the "New Chat" button.
    try {
      console.log(`[TabSessionManager] Sending START_NEW_CHAT to tab ${tabId}`);
      const response = await chrome.tabs.sendMessage(tabId, { type: START_NEW_CHAT });
      
      if (!response || !response.success) {
        throw new Error(response.error || 'Content script failed to start a new chat.');
      }
      console.log(`[TabSessionManager] Content script successfully started new chat for tab ${tabId}.`);

      // Step 2: Only on success, generate and store a new session ID.
      const newSessionId = crypto.randomUUID();
      const key = `session_${tabId}`;
      await chrome.storage.session.set({ [key]: newSessionId });
      console.log(`[TabSessionManager] New session ID generated for tab ${tabId}: ${newSessionId}`);
      
      // Give the UI a moment to settle after the click.
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return newSessionId;

    } catch (error) {
      console.error(`[TabSessionManager] Failed to reset session for tab ${tabId}:`, error);
      throw new Error(`Could not start a new chat on ${tabInfo.platformKey}. Ensure the tab is active and not busy. Error: ${error.message}`);
    }
  }
}

export const tabSessionManager = new TabSessionManager();
