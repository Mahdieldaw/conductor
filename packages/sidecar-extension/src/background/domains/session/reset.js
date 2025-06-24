import { tabPool } from '../../utils/tab-pool.js';
import { flightManager } from '../../utils/flight-manager.js';

/**
 * Resets the session for a given platform.
 * @param {object} payload - The message payload.
 * @param {string} payload.platform - The platform key to reset the session for.
 * @returns {Promise<{success: boolean}>} A promise that resolves with the reset status.
 */
export async function reset({ platform }) {
  const tab = await tabPool.getWorkerTab(platform);
  if (!tab) {
    throw new Error(`No active tab for platform: ${platform}`);
  }
  
  // Cancel any active flights for this tab and reset its state
  flightManager.cancelFlightsForTab(tab.id);
  tabPool.releaseWorkerTab(tab.id);
  
  return { success: true };
}