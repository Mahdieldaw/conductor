import { findTabByPlatform } from '../../utils/tab-manager.js';
import { tabSessionManager } from '../../utils/tab-session-manager.js';

/**
 * Resets the session for a given platform.
 * @param {object} payload - The message payload.
 * @param {string} payload.platform - The platform key to reset the session for.
 * @returns {Promise<{newSessionId: string}>} A promise that resolves with the new session ID.
 */
export async function reset({ platform }) {
  const tabToReset = findTabByPlatform(platform);
  if (!tabToReset) {
    throw new Error(`No active tab for platform: ${platform}`);
  }
  const newSessionId = await tabSessionManager.resetSession(tabToReset.tabId);
  return { newSessionId };
}