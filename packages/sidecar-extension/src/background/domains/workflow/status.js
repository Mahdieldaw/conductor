/**
 * Workflow Status Handler
 * 
 * Handles requests for workflow execution status
 */

import { getActiveWorkflows } from './execute.js';
import { MemoryManager } from '../../utils/memoryManager.js';

const memoryManager = new MemoryManager();

/**
 * Get the status of a workflow execution
 * @param {Object} payload - The status request payload
 * @param {string} payload.sessionId - ID of the session to check
 * @param {Object} context - Request context
 * @returns {Promise<Object>} Workflow status information
 */
export async function status(payload, context) {
  const { sessionId } = payload;
  
  console.log(`[Workflow] Getting status for session ${sessionId}`);
  
  try {
    // First check active workflows
    const activeWorkflows = getActiveWorkflows();
    const activeWorkflow = activeWorkflows.find(w => w.sessionId === sessionId);
    
    if (activeWorkflow) {
      return {
        sessionId,
        status: activeWorkflow.status,
        currentStep: activeWorkflow.currentStep,
        totalSteps: activeWorkflow.steps?.length || 0,
        completedSteps: activeWorkflow.steps?.length || 0,
        startTime: activeWorkflow.startTime,
        isActive: true
      };
    }
    
    // If not active, check stored sessions
    const sessionRecord = await memoryManager.getSession(sessionId);
    
    if (!sessionRecord) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    return {
      sessionId,
      status: sessionRecord.status,
      currentStep: sessionRecord.currentStep,
      totalSteps: sessionRecord.steps?.length || 0,
      completedSteps: sessionRecord.steps?.length || 0,
      startTime: sessionRecord.startTime,
      endTime: sessionRecord.endTime,
      isActive: false,
      error: sessionRecord.error
    };
    
  } catch (error) {
    console.error(`[Workflow] Error getting status for session ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Get status of all workflows
 * @param {Object} payload - Empty payload
 * @param {Object} context - Request context
 * @returns {Promise<Object>} All workflow statuses
 */
export async function getAllStatuses(payload, context) {
  console.log('[Workflow] Getting all workflow statuses');
  
  try {
    const activeWorkflows = getActiveWorkflows();
    const hotCache = await memoryManager.getHotCache();
    
    return {
      active: activeWorkflows.map(w => ({
        sessionId: w.sessionId,
        workflowId: w.workflowId,
        status: w.status,
        currentStep: w.currentStep,
        startTime: w.startTime,
        isActive: true
      })),
      recent: hotCache.map(session => ({
        sessionId: session.sessionId,
        workflowId: session.workflowId,
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        isActive: false
      }))
    };
    
  } catch (error) {
    console.error('[Workflow] Error getting all statuses:', error);
    throw error;
  }
}