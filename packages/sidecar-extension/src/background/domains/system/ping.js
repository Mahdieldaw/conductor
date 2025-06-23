/**
 * Handles a PING message, responding with 'pong'.
 * @returns {Promise<string>} A promise that resolves with 'pong'.
 */
export async function ping() {
  console.log('[PING] Handler called, returning pong');
  return 'pong'; // This should return the string, not a function
}