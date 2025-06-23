import { tabManager } from '../../utils/tab-manager.js';
import { sendMessage } from '../../utils/message-sender.js';

export default async function harvest({ providerKey, tabId }) {
  let targetTabId = tabId;

  if (!targetTabId) {
    const targetTab = await tabManager.findTabByProviderKey(providerKey);
    if (!targetTab) {
      throw new Error(`Harvest failed: No tab for provider ${providerKey}.`);
    }
    targetTabId = targetTab.tabId;
  }

  // Use the message-sender utility for reliable communication
  const response = await sendMessage(targetTabId, {
    type: 'HARVEST_RESPONSE'
  }, {
    enableLogging: true,
    enableRetry: true,
    timeout: 30000 // Extended timeout for harvest operations (30 seconds)
  });
  
  return response;
}