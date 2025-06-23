import { tabManager } from '../../utils/tab-manager.js';
import { sendMessage } from '../../utils/message-sender.js';

export default async function harvest({ platform }) {
  const targetTab = tabManager.findTabByPlatform(platform);
  if (!targetTab) {
    throw new Error(`Harvest failed: No tab for platform ${platform}.`);
  }

  // Use the message-sender utility for reliable communication
  const response = await sendMessage(targetTab.tabId, {
    type: 'HARVEST_RESPONSE'
  }, {
    enableLogging: true,
    enableRetry: true,
    timeout: 8000 // Reasonable timeout for harvest operations
  });
  
  return response;
}