/**
 * Utility for sending messages to content scripts with proper error handling
 * and Promise-based interface.
 */

/**
 * Sends a message to a tab's content script with comprehensive error handling.
 * 
 * @param {number} tabId - The ID of the tab to send the message to
 * @param {object} message - The message object to send
 * @param {number} [timeout=5000] - Timeout in milliseconds (default: 5 seconds)
 * @returns {Promise<any>} Promise that resolves with the response or rejects with an error
 */
export async function sendMessageToTab(tabId, message, timeout = 5000) {
  return new Promise((resolve, reject) => {
    // Set up timeout
    const timeoutId = setTimeout(() => {
      reject(new Error(`Message timeout after ${timeout}ms for tab ${tabId}`));
    }, timeout);

    // Send the message
    chrome.tabs.sendMessage(tabId, message, (response) => {
      clearTimeout(timeoutId);
      
      // Check for Chrome runtime errors
      if (chrome.runtime.lastError) {
        reject(new Error(`Chrome runtime error: ${chrome.runtime.lastError.message}`));
        return;
      }
      
      // Check for explicit error responses from content script
      if (response && response.success === false) {
        reject(new Error(response.error || 'Content script returned error'));
        return;
      }
      
      // Check if response is undefined (content script didn't respond)
      if (response === undefined) {
        reject(new Error('No response from content script - script may not be loaded'));
        return;
      }
      
      resolve(response);
    });
  });
}

/**
 * Sends a message to a tab with retry logic.
 * 
 * @param {number} tabId - The ID of the tab to send the message to
 * @param {object} message - The message object to send
 * @param {object} options - Options for retry behavior
 * @param {number} [options.maxRetries=2] - Maximum number of retry attempts
 * @param {number} [options.retryDelay=1000] - Delay between retries in milliseconds
 * @param {number} [options.timeout=5000] - Timeout per attempt in milliseconds
 * @returns {Promise<any>} Promise that resolves with the response or rejects with an error
 */
export async function sendMessageToTabWithRetry(tabId, message, options = {}) {
  const {
    maxRetries = 2,
    retryDelay = 1000,
    timeout = 5000
  } = options;
  
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await sendMessageToTab(tabId, message, timeout);
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain types of errors
      if (error.message.includes('No tab with id') || 
          error.message.includes('Cannot access') ||
          error.message.includes('Extension context invalidated')) {
        throw error;
      }
      
      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  throw lastError;
}

/**
 * Logs message sending activity for debugging purposes.
 * 
 * @param {number} tabId - The tab ID
 * @param {object} message - The message being sent
 * @param {string} operation - Description of the operation
 */
export function logMessageActivity(tabId, message, operation) {
  console.log(`[MessageSender] ${operation}:`, {
    tabId,
    messageType: message.type,
    timestamp: new Date().toISOString()
  });
}

/**
 * Enhanced message sender with logging and metrics.
 * 
 * @param {number} tabId - The ID of the tab to send the message to
 * @param {object} message - The message object to send
 * @param {object} options - Options for the message
 * @param {boolean} [options.enableLogging=false] - Whether to enable logging
 * @param {boolean} [options.enableRetry=false] - Whether to enable retry logic
 * @param {number} [options.timeout=5000] - Timeout in milliseconds
 * @returns {Promise<any>} Promise that resolves with the response or rejects with an error
 */
export async function sendMessage(tabId, message, options = {}) {
  const {
    enableLogging = false,
    enableRetry = false,
    timeout = 5000,
    ...retryOptions
  } = options;
  
  if (enableLogging) {
    logMessageActivity(tabId, message, 'Sending message');
  }
  
  try {
    const response = enableRetry 
      ? await sendMessageToTabWithRetry(tabId, message, { timeout, ...retryOptions })
      : await sendMessageToTab(tabId, message, timeout);
    
    if (enableLogging) {
      logMessageActivity(tabId, message, 'Message sent successfully');
    }
    
    return response;
  } catch (error) {
    if (enableLogging) {
      console.error(`[MessageSender] Failed to send message to tab ${tabId}:`, error);
    }
    throw error;
  }
}