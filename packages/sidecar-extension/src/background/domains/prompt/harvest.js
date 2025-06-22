import { findTabByPlatform } from '../../utils/tab-manager.js';
import { activateTabIfConfigured } from '../../../utils/tab-activator.js';

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
    console.error('[Harvest] Failed to load configs:', error);
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

export default async function harvest(payload) {
  const { platform } = payload;
  
  if (!platform) {
    throw new Error('Platform is required for harvesting.');
  }

  console.log(`[Harvest] Starting harvest for platform: ${platform}`);

  // Find the tab for this platform
  const tab = await findTabByPlatform(platform);
  if (!tab) {
    throw new Error(`No tab found for platform: ${platform}`);
  }

  console.log(`[Harvest] Found tab for ${platform}:`, tab.tabId);

  // Get provider config and check if tab activation is needed
  const config = await getProviderConfig(platform);
  await activateTabIfConfigured(tab.tabId, config, 'harvest');

  // Send harvest message to the content script
  const response = await chrome.tabs.sendMessage(tab.tabId, {
    type: 'HARVEST_RESPONSE'
  });

  console.log(`[Harvest] Response from ${platform}:`, response);
  return response;
}