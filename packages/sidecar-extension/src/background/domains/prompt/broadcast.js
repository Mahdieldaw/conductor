import { tabManager } from '../../utils/tab-manager.js';
import { sendMessage } from '../../utils/message-sender.js';

export default async function broadcast({ providerKey, prompt, tabId }) {
  let targetTabId = tabId;

  if (!targetTabId) {
    const targetTab = await tabManager.findTabByProviderKey(providerKey);
    if (!targetTab) {
      throw new Error(`Broadcast failed: No tab for provider ${providerKey}.`);
    }
    targetTabId = targetTab.tabId;
  }

  // Use the message-sender utility for reliable communication
  const response = await sendMessage(targetTabId, {
    type: 'BROADCAST_PROMPT',
    payload: { prompt }
  }, {
    enableLogging: true,
    enableRetry: true,
    timeout: 10000 // Longer timeout for broadcast operations
  });

  return response;
}