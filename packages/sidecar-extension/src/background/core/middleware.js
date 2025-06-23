/**
 * Middleware System - Provides cross-cutting concerns for message processing
 * 
 * This module provides middleware functions that can be composed into a pipeline
 * to handle logging, metrics, validation, and other cross-cutting concerns.
 */

/**
 * Creates a middleware function with the given configuration
 * @param {Function} middlewareFn - The middleware function
 * @param {Object} config - Configuration for the middleware
 * @returns {Function} Configured middleware function
 */
export function createMiddleware(middlewareFn, config = {}) {
  return async function(context, next) {
    return await middlewareFn(context, next, config);
  };
}

/**
 * Logging middleware - Logs request details and timing
 * @param {Object} context - Request context
 * @param {Function} next - Next function in the chain
 * @param {Object} config - Middleware configuration
 * @returns {*} Result from next middleware/handler
 */
export async function loggingMiddleware(context, next, config = {}) {
  const { logLevel = 'info', includePayload = false } = config;
  
  const logData = {
    requestId: context.requestId,
    messageType: context.message.type,
    timestamp: new Date(context.timestamp).toISOString(),
    sender: context.sender.id || 'unknown'
  };

  if (includePayload) {
    logData.payload = context.message.payload;
  }

  console.log(`[Middleware:Logging] Request started:`, logData);

  try {
    const result = await next();
    
    const duration = performance.now() - context.startTime;
    console.log(`[Middleware:Logging] Request completed in ${duration.toFixed(2)}ms:`, {
      requestId: context.requestId,
      success: true,
      duration
    });
    
    return result;
  } catch (error) {
    const duration = performance.now() - context.startTime;
    console.error(`[Middleware:Logging] Request failed in ${duration.toFixed(2)}ms:`, {
      requestId: context.requestId,
      error: error.message,
      duration
    });
    
    throw error;
  }
}

/**
 * Metrics middleware - Collects performance and usage metrics
 * @param {Object} context - Request context
 * @param {Function} next - Next function in the chain
 * @param {Object} config - Middleware configuration
 * @returns {*} Result from next middleware/handler
 */
export async function metricsMiddleware(context, next, config = {}) {
  const { collectDetailedMetrics = false } = config;
  
  const startTime = performance.now();
  const startMemory = collectDetailedMetrics ? performance.memory?.usedJSHeapSize : null;
  
  try {
    const result = await next();
    
    const duration = performance.now() - startTime;
    const endMemory = collectDetailedMetrics ? performance.memory?.usedJSHeapSize : null;
    
    // Store metrics (in a real implementation, this would go to a metrics store)
    const metrics = {
      requestId: context.requestId,
      messageType: context.message.type,
      duration,
      success: true,
      timestamp: context.timestamp
    };
    
    if (collectDetailedMetrics && startMemory && endMemory) {
      metrics.memoryDelta = endMemory - startMemory;
    }
    
    console.log(`[Middleware:Metrics] Collected:`, metrics);
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    const metrics = {
      requestId: context.requestId,
      messageType: context.message.type,
      duration,
      success: false,
      error: error.message,
      timestamp: context.timestamp
    };
    
    console.log(`[Middleware:Metrics] Collected (error):`, metrics);
    
    throw error;
  }
}

/**
 * Validation middleware - Validates message structure and payload
 * @param {Object} context - Request context
 * @param {Function} next - Next function in the chain
 * @param {Object} config - Middleware configuration containing schemas
 * @returns {*} Result from next middleware/handler
 */
export async function validationMiddleware(context, next, config = {}) {
  const { schemas = {} } = config;
  const schema = schemas[context.message.type];
    
    if (!schema) {
      console.log(`[Middleware:Validation] No schema found for message type: ${context.message.type}`);
      return await next();
    }

    // Skip validation for PING messages or messages with required: false
    if (context.message.type === 'PING' || schema.required === false) {
      console.log(`[Middleware:Validation] Skipping validation for ${context.message.type} (not required)`);
      return await next();
    }

    // Debug: Log the actual message structure
    console.log(`[Middleware:Validation] Debug - Full message:`, JSON.stringify(context.message, null, 2));
    console.log(`[Middleware:Validation] Debug - Message keys:`, Object.keys(context.message));
    console.log(`[Middleware:Validation] Debug - Has payload:`, 'payload' in context.message);

    try {
      // In a real implementation, you would use a proper schema validation library
      // For now, we'll do basic validation
      validatePayloadStructure(context.message.payload, schema);
    } catch (validationError) {
      throw new Error(`Validation failed for ${context.message.type}: ${validationError.message}`);
    }
    
    console.log(`[Middleware:Validation] Message validated:`, {
      requestId: context.requestId,
      messageType: context.message.type,
      hasSchema: !!schema
    });
    
    return await next();
}

/**
 * Basic payload structure validation
 * @param {*} payload - The payload to validate
 * @param {Object} schema - Simple schema definition
 */
function validatePayloadStructure(payload, schema) {
  if (schema.required && (!payload || typeof payload !== 'object')) {
    throw new Error('Payload is required and must be an object');
  }
  
  if (schema.properties && payload) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (propSchema.required && !(key in payload)) {
        throw new Error(`Required property '${key}' is missing`);
      }
      
      if (key in payload && propSchema.type) {
        const value = payload[key];
        const actualType = typeof value;
        
        // Handle array type validation
        if (propSchema.type === 'array') {
          if (!Array.isArray(value)) {
            throw new Error(`Property '${key}' must be an array, got ${actualType}`);
          }
        } else if (propSchema.type === 'object') {
          if (actualType !== 'object' || value === null) {
            throw new Error(`Property '${key}' must be an object, got ${actualType}`);
          }
          
          // Recursively validate nested object properties
          if (propSchema.properties) {
            validatePayloadStructure(value, propSchema);
          }
        } else if (actualType !== propSchema.type) {
          throw new Error(`Property '${key}' must be of type ${propSchema.type}, got ${actualType}`);
        }
      }
    }
  }
}