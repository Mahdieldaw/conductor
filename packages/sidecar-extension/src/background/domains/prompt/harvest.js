import { sendMessage } from '../../utils/message-sender.js';
import { tabPool } from '../../utils/tab-pool.js';
import { HARVEST_RESPONSE } from '@hybrid-thinking/messaging';

export default async function harvest({ providerKey, tabId }) {
  let targetTabId = tabId;

  if (!targetTabId) {
    const targetTab = await tabPool.getWorkerTab(providerKey);
    if (!targetTab) {
      throw new Error(`Harvest failed: No tab for provider ${providerKey}.`);
    }
    targetTabId = targetTab.id;
  }

  // Use the message-sender utility for reliable communication
  const response = await sendMessage(targetTabId, {
    type: HARVEST_RESPONSE
  }, {
    enableLogging: true,
    enableRetry: true,
    timeout: 30000 // Extended timeout for harvest operations (30 seconds)
  });
  
  return response;
}