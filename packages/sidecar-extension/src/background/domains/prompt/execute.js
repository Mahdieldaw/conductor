import broadcast from './broadcast.js';
import harvest from './harvest.js';
import { findTabByPlatform } from '../../utils/tab-manager.js';
import { CHECK_READINESS } from '@hybrid-thinking/messaging';

// Provider config loading (similar to harvest.js)
let configs = {};
let configsLoaded = false;

async function loadConfigs() {
  if (configsLoaded) return;
  
  try {
    const configNames = ['chatgpt', 'claude'];
    
    for (const name of configNames) {
      const url = chrome.runtime.getURL(`content/configs/${name}.json`);
      const response = await fetch(url);
      configs[name] = await response.json();
    }
    
    configsLoaded = true;
  } catch (error) {
    console.error('[Execute] Failed to load configs:', error);
  }
}

async function getProviderConfig(platformKey) {
  await loadConfigs();
  const config = configs[platformKey];
  if (!config) {
    throw new Error(`Config file not found for platform: ${platformKey}`);
  }
  return config;
}

/**
 * Orchestrates the full prompt execution workflow: ensuring provider readiness, broadcasting the prompt and then harvesting the response.
 * @param {object} payload - The message payload.
 * @param {string} payload.platform - The platform key (e.g., 'chatgpt', 'claude').
 * @param {string} payload.prompt - The prompt text to execute.
 * @param {string} [payload.sessionId] - An optional session ID.
 * @returns {Promise<string>} A promise that resolves with the harvested response or rejects with an error.
 */
export default async function execute({ platform, prompt, sessionId }) {
  const targetTab = await findTabByPlatform(platform);
  if (!targetTab) throw new Error(`No active tab for platform: ${platform}`);

  // Load provider configuration
  const config = await getProviderConfig(platform);
  if (!config) {
    throw new Error(`No configuration found for platform: ${platform}`);
  }

  // Ensure provider is initialized by sending a readiness check
  const readinessResult = await chrome.tabs.sendMessage(targetTab.tabId, {
    type: CHECK_READINESS,
    payload: { config }
  });
  
  if (!readinessResult || readinessResult.success === false) {
    throw new Error(`Provider not ready: ${readinessResult?.error || 'Unknown error'}`);
  }

  await broadcast({ platform, prompt });
  return await harvest({ platform });
}