// Legacy tab-manager import removed - now using TabPool
import { sendMessage } from '../../utils/message-sender.js';
import { tabPool } from '../../utils/tab-pool.js';
import { BROADCAST_PROMPT } from '@hybrid-thinking/messaging';

export default async function broadcast({ providerKey, prompt, tabId }) {
  let targetTabId = tabId;

  if (!targetTabId) {
    // Use the new TabPool to get a worker tab
    const tab = await tabPool.getWorkerTab(providerKey);
    if (!tab) {
      throw new Error(`Broadcast failed: No tab available for provider ${providerKey}.`);
    }
    targetTabId = tab.tabId;
  }

  try {
    // Use the message-sender utility for reliable communication
    const response = await sendMessage(targetTabId, {
      type: BROADCAST_PROMPT,
      payload: { prompt }
    }, {
      enableLogging: true,
      enableRetry: true,
      timeout: 10000 // Longer timeout for broadcast operations
    });

    return response;
  } catch (error) {
    // If we acquired the tab, release it back to the pool on error
    if (!tabId && targetTabId) {
      tabPool.releaseTab(targetTabId);
    }
    throw error;
  } finally {
    // If we acquired the tab, release it back to the pool
    if (!tabId && targetTabId) {
      tabPool.releaseTab(targetTabId);
    }
  }
}