import { tabManager } from './tab-manager.js'; // Assuming tab-manager.js still holds the core tab state

/**
 * Finds a managed tab by its platform key.
 * @param {string} platform - The platform key (e.g., 'chatgpt', 'claude').
 * @returns {object|undefined} The found tab object or undefined if not found.
 */
export function findTabByPlatform(platform) {
  return tabManager.findTabByPlatform(platform);
}

/**
 * Gets all currently managed tabs.
 * @returns {Array<object>} An array of all managed tab objects.
 */
export function getAllTabs() {
  return tabManager.getAllTabs();
}