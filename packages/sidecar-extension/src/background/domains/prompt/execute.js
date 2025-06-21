import { findTabByPlatform } from '../../utils/tab-finder.js';
import broadcast from './broadcast.js';
import harvest from './harvest.js';

/**
 * Orchestrates the full prompt execution workflow: broadcasting the prompt and then harvesting the response.
 * @param {object} payload - The message payload.
 * @param {string} payload.platform - The platform key (e.g., 'chatgpt', 'claude').
 * @param {string} payload.prompt - The prompt text to execute.
 * @param {string} [payload.sessionId] - An optional session ID.
 * @returns {Promise<string>} A promise that resolves with the harvested response or rejects with an error.
 */
export default async function execute({ platform, prompt, sessionId }) {
  const targetTab = findTabByPlatform(platform);
  if (!targetTab) throw new Error(`No active tab for platform: ${platform}`);

  await broadcast({ platform, prompt });
  return await harvest({ platform });
}