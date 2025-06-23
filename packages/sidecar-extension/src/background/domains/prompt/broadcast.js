import { tabManager } from '../../utils/tab-manager.js';
import { sendMessage } from '../../utils/message-sender.js';

export default async function broadcast({ platform, prompt }) {
  const targetTab = tabManager.findTabByPlatform(platform);
  if (!targetTab) {
    throw new Error(`Broadcast failed: No tab for platform ${platform}.`);
  }

  // Use the message-sender utility for reliable communication
  const response = await sendMessage(targetTab.tabId, {
    type: 'BROADCAST_PROMPT',
    payload: { prompt }
  }, {
    enableLogging: true,
    enableRetry: true,
    timeout: 10000 // Longer timeout for broadcast operations
  });

  return response;
}