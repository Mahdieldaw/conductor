/**
 * Message Router - Core routing system for handling external messages
 * 
 * This module provides a centralized message routing system that:
 * - Routes messages to appropriate handlers based on message type
 * - Creates request context with unique IDs for tracking
 * - Supports middleware pipeline for cross-cutting concerns
 * - Provides consistent error handling
 */

/**
 * Creates a message router with the given handlers and middleware
 * @param {Object} handlers - Map of message types to handler functions
 * @param {Object} options - Configuration options
 * @param {Array} options.middleware - Array of middleware functions
 * @returns {Function} Router function that processes messages
 */
export function createMessageRouter(handlers, options = {}) {
  const { middleware = [], errorHandler } = options;

  return async function router(message, sender, sendResponse) {
    // Create request context with unique ID for tracking
    const context = {
      requestId: crypto.randomUUID(),
      message,
      sender,
      timestamp: Date.now(),
      startTime: performance.now()
    };

    console.log(`[Router] Processing message ${message.type} with requestId: ${context.requestId}`);

    try {
      // Find the appropriate handler
      const handler = handlers[message.type];
      if (!handler) {
        throw new Error(`No handler found for message type: ${message.type}`);
      }

      // Create middleware pipeline
      let result;
      if (middleware.length > 0) {
        // Execute middleware chain
        result = await executeMiddlewareChain(middleware, context, handler);
      } else {
        // Execute handler directly
        result = await handler(message.payload, context);
      }

      // Send successful response
      sendResponse({ 
        success: true, 
        data: result,
        requestId: context.requestId
      });

    } catch (error) {
      console.error(`[Router] Error processing message ${message.type}:`, error);
      
      if (errorHandler) {
        const processedError = errorHandler(error, context);
        sendResponse({ success: false, error: processedError });
      } else {
        sendResponse({
          success: false,
          error: { message: error.message, requestId: context.requestId },
        });
      }
    }
  };
}

/**
 * Executes the middleware chain and final handler
 * @param {Array} middleware - Array of middleware functions
 * @param {Object} context - Request context
 * @param {Function} handler - Final handler function
 * @returns {*} Result from the handler
 */
async function executeMiddlewareChain(middleware, context, handler) {
  let index = 0;

  async function next() {
    if (index >= middleware.length) {
      // All middleware executed, call the final handler
      return await handler(context.message.payload, context);
    }

    const currentMiddleware = middleware[index++];
    return await currentMiddleware(context, next);
  }

  return await next();
}