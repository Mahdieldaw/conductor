/**
 * Workflow Result Handler
 * 
 * Handles requests for workflow execution results
 */

import { MemoryManager } from '../../memory-manager.js';

const memoryManager = new MemoryManager();

/**
 * Get the result of a completed workflow execution
 * @param {Object} payload - The result request payload
 * @param {string} payload.sessionId - ID of the session to get results for
 * @param {boolean} payload.includeSteps - Whether to include individual step results
 * @param {Object} context - Request context
 * @returns {Promise<Object>} Workflow execution results
 */
export async function result(payload, context) {
  const { sessionId, includeSteps = false } = payload;
  
  console.log(`[Workflow] Getting result for session ${sessionId}`);
  
  try {
    // Get session record from memory
    const sessionRecord = await memoryManager.getSession(sessionId);
    
    if (!sessionRecord) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    if (sessionRecord.status === 'running') {
      throw new Error(`Session ${sessionId} is still running`);
    }
    
    const result = {
      sessionId,
      workflowId: sessionRecord.workflowId,
      status: sessionRecord.status,
      startTime: sessionRecord.startTime,
      endTime: sessionRecord.endTime,
      duration: sessionRecord.endTime - sessionRecord.startTime,
      result: sessionRecord.result
    };
    
    if (sessionRecord.error) {
      result.error = sessionRecord.error;
    }
    
    if (includeSteps && sessionRecord.steps) {
      result.steps = sessionRecord.steps.map(step => ({
        stepId: step.stepId,
        platform: step.platform,
        prompt: step.prompt,
        result: step.result,
        timestamp: step.timestamp
      }));
    }
    
    return result;
    
  } catch (error) {
    console.error(`[Workflow] Error getting result for session ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Get results for multiple sessions
 * @param {Object} payload - The batch result request payload
 * @param {string[]} payload.sessionIds - Array of session IDs
 * @param {boolean} payload.includeSteps - Whether to include individual step results
 * @param {Object} context - Request context
 * @returns {Promise<Object[]>} Array of workflow execution results
 */
export async function batchResults(payload, context) {
  const { sessionIds, includeSteps = false } = payload;
  
  console.log(`[Workflow] Getting batch results for ${sessionIds.length} sessions`);
  
  try {
    const results = [];
    
    for (const sessionId of sessionIds) {
      try {
        const result = await result({ sessionId, includeSteps }, context);
        results.push(result);
      } catch (error) {
        console.warn(`[Workflow] Failed to get result for session ${sessionId}:`, error.message);
        results.push({
          sessionId,
          error: error.message
        });
      }
    }
    
    return results;
    
  } catch (error) {
    console.error('[Workflow] Error getting batch results:', error);
    throw error;
  }
}