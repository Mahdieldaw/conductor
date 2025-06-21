import { findTabByPlatform } from '../../utils/tab-finder.js';
import { BROADCAST_PROMPT } from '@hybrid-thinking/messaging';

/**
 * Handles broadcasting a prompt to a specific platform's tab.
 * @param {object} payload - The message payload.
 * @param {string} payload.platform - The platform key (e.g., 'chatgpt', 'claude').
 * @param {string} payload.prompt - The prompt text to broadcast.
 * @returns {Promise<object>} A promise that resolves with the content script's response or rejects with an error.
 */
export default async function broadcast({ platform, prompt }) {
  const targetTab = findTabByPlatform(platform);
  if (!targetTab) throw new Error(`Broadcast failed: No active tab for platform: ${platform}`);

  const response = await chrome.tabs.sendMessage(targetTab.tabId, {
    type: BROADCAST_PROMPT,
    payload: { prompt }
  });

  if (response && response.success === false) {
    throw new Error(response.error || 'Broadcast failed in content script.');
  }

  // Assuming the content script returns a success message or data
  return response?.data || 'Prompt broadcasted successfully.';
}