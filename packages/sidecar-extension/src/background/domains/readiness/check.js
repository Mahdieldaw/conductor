import { CHECK_READINESS } from '@hybrid-thinking/messaging';
import { findTabByPlatform } from '../../utils/tab-finder.js';

/**
 * Handles checking the readiness of a specific platform's tab.
 * Loads the provider's JSON config from the extension's package.
 * @param {string} providerKey - The key for the provider (e.g., 'chatgpt').
 * @returns {Promise<object>} The provider configuration.
 */
async function getProviderConfig(providerKey) {
  const url = chrome.runtime.getURL(`content/configs/${providerKey}.json`);
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Config not found for ${providerKey}: ${resp.statusText}`);
    return await resp.json();
  } catch (e) {
    console.error(`Failed to load config for ${providerKey}:`, e);
    throw new Error(`Failed to load configuration for ${providerKey}.`);
  }
}

/**
 * Checks the readiness of a specific LLM platform tab.
 * @param {object} payload - The message payload.
 * @param {string} payload.providerKey - The provider key (e.g., 'chatgpt', 'claude').
 * @returns {Promise<object>} An object indicating readiness status and data.
 */
export async function check({ providerKey }) {
  const config = await getProviderConfig(providerKey);
  const tab = findTabByPlatform(providerKey);
  if (!tab) {
    return { status: 'TAB_NOT_OPEN', message: `${config.name || providerKey} tab is not open.`, data: { url: config.url } };
  }

  // Readiness Verification via content script
  try {
    const scriptResponse = await chrome.tabs.sendMessage(tab.tabId, {
      type: CHECK_READINESS,
      payload: { config }
    });
    const { status, message } = scriptResponse?.data || {};

    if (status === 'READY') {
      return { status: 'READY', message: 'Connection successful!', data: { tabId: tab.tabId } };
    }
    return { status, message, data: { url: config.url } };
  } catch (error) {
    console.error(`[Handler:CheckReadiness] Error checking readiness for ${providerKey}:`, error);
    throw new Error(`Failed to check readiness for ${providerKey}: ${error.message}`);
  }
}