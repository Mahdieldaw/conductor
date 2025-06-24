import { tabPool } from '../../utils/tab-pool.js';

/**
 * Retrieves a list of all available LLM tabs managed by the extension.
 * @returns {Promise<Array<object>>} A promise that resolves with an array of tab objects.
 */
export async function getAvailableTabs() {
  return tabPool.getAllTabs();
}