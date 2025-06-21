import { findTabByPlatform } from '../../utils/tab-finder.js';
import { HARVEST_RESPONSE } from '@hybrid-thinking/messaging';

/**
 * Handles harvesting a response from a specific platform's tab.
 * @param {object} payload - The message payload.
 * @param {string} payload.platform - The platform key (e.g., 'chatgpt', 'claude').
 * @returns {Promise<object>} A promise that resolves with the harvested response data or rejects with an error.
 */
export default async function harvest({ platform }) {
  const targetTab = findTabByPlatform(platform);
  if (!targetTab) throw new Error(`Harvest failed: No active tab for platform: ${platform}`);

  const response = await chrome.tabs.sendMessage(targetTab.tabId, {
    type: HARVEST_RESPONSE,
    payload: { platform }
  });

  if (response && response.success === false) {
    throw new Error(response.error || 'Harvest failed in content script.');
  }

  return response.data;
}