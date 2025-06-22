/**
 * Memory Full History Handler
 * 
 * Handles requests for complete workflow session history from cold storage
 */

import { MemoryManager } from '../../memory-manager.js';

const memoryManager = new MemoryManager();

/**
 * Get the complete workflow session history
 * @param {Object} payload - The history request payload
 * @param {number} payload.limit - Maximum number of sessions to return (default: 50)
 * @param {number} payload.offset - Number of sessions to skip (default: 0)
 * @param {string} payload.workflowId - Filter by specific workflow ID (optional)
 * @param {string} payload.status - Filter by status (optional)
 * @param {number} payload.startDate - Filter by start date (timestamp, optional)
 * @param {number} payload.endDate - Filter by end date (timestamp, optional)
 * @param {Object} context - Request context
 * @returns {Promise<Object>} Complete history with pagination info
 */
export async function getFullHistory(payload, context) {
  const { 
    limit = 50, 
    offset = 0, 
    workflowId, 
    status, 
    startDate, 
    endDate 
  } = payload || {};
  
  console.log(`[Memory] Getting full history (limit: ${limit}, offset: ${offset})`);
  
  try {
    // Get all sessions from cold storage
    const allSessions = await memoryManager.getFullHistory(limit * 2, 0); // Get more to allow for filtering
    
    // Apply filters
    let filteredSessions = allSessions;
    
    if (workflowId) {
      filteredSessions = filteredSessions.filter(session => session.workflowId === workflowId);
    }
    
    if (status) {
      filteredSessions = filteredSessions.filter(session => session.status === status);
    }
    
    if (startDate) {
      filteredSessions = filteredSessions.filter(session => session.startTime >= startDate);
    }
    
    if (endDate) {
      filteredSessions = filteredSessions.filter(session => session.startTime <= endDate);
    }
    
    // Apply pagination
    const paginatedSessions = filteredSessions.slice(offset, offset + limit);
    
    // Return simplified session data for UI performance
    const simplifiedSessions = paginatedSessions.map(session => ({
      sessionId: session.sessionId,
      workflowId: session.workflowId,
      status: session.status,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.endTime ? session.endTime - session.startTime : null,
      stepCount: session.steps ? session.steps.length : 0,
      hasError: !!session.error,
      input: session.input ? (typeof session.input === 'string' ? session.input.substring(0, 100) : JSON.stringify(session.input).substring(0, 100)) : null
    }));
    
    console.log(`[Memory] Retrieved ${simplifiedSessions.length} sessions from full history`);
    
    return {
      sessions: simplifiedSessions,
      pagination: {
        limit,
        offset,
        count: simplifiedSessions.length,
        total: filteredSessions.length,
        hasMore: offset + limit < filteredSessions.length
      },
      filters: {
        workflowId,
        status,
        startDate,
        endDate
      },
      timestamp: Date.now()
    };
    
  } catch (error) {
    console.error('[Memory] Error getting full history:', error);
    throw error;
  }
}

/**
 * Get detailed information for a specific session from full history
 * @param {Object} payload - The request payload
 * @param {string} payload.sessionId - ID of the session to get details for
 * @param {boolean} payload.includeSteps - Whether to include step details (default: false)
 * @param {Object} context - Request context
 * @returns {Promise<Object|null>} Detailed session record or null if not found
 */
export async function getHistorySession(payload, context) {
  const { sessionId, includeSteps = false } = payload;
  
  console.log(`[Memory] Getting session ${sessionId} from full history`);
  
  try {
    const session = await memoryManager.getSession(sessionId);
    
    if (!session) {
      console.log(`[Memory] Session ${sessionId} not found in full history`);
      return null;
    }
    
    const result = {
      sessionId: session.sessionId,
      workflowId: session.workflowId,
      status: session.status,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.endTime ? session.endTime - session.startTime : null,
      input: session.input,
      result: session.result,
      error: session.error
    };
    
    if (includeSteps && session.steps) {
      result.steps = session.steps;
    } else if (session.steps) {
      result.stepCount = session.steps.length;
    }
    
    console.log(`[Memory] Found session ${sessionId} in full history`);
    return result;
    
  } catch (error) {
    console.error(`[Memory] Error getting session ${sessionId} from full history:`, error);
    throw error;
  }
}

/**
 * Get workflow execution statistics
 * @param {Object} payload - The stats request payload
 * @param {number} payload.days - Number of days to include in stats (default: 30)
 * @param {Object} context - Request context
 * @returns {Promise<Object>} Workflow execution statistics
 */
export async function getWorkflowStats(payload, context) {
  const { days = 30 } = payload || {};
  
  console.log(`[Memory] Getting workflow stats for last ${days} days`);
  
  try {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const allSessions = await memoryManager.getFullHistory(1000, 0); // Get a large sample
    
    // Filter to recent sessions
    const recentSessions = allSessions.filter(session => session.startTime >= cutoffTime);
    
    // Calculate statistics
    const stats = {
      totalSessions: recentSessions.length,
      completedSessions: recentSessions.filter(s => s.status === 'completed').length,
      failedSessions: recentSessions.filter(s => s.status === 'failed').length,
      runningSessions: recentSessions.filter(s => s.status === 'running').length,
      
      workflowBreakdown: {},
      averageDuration: 0,
      totalDuration: 0,
      
      dailyStats: {},
      
      period: {
        days,
        startDate: cutoffTime,
        endDate: Date.now()
      }
    };
    
    // Calculate workflow breakdown
    recentSessions.forEach(session => {
      if (!stats.workflowBreakdown[session.workflowId]) {
        stats.workflowBreakdown[session.workflowId] = {
          total: 0,
          completed: 0,
          failed: 0,
          running: 0
        };
      }
      
      stats.workflowBreakdown[session.workflowId].total++;
      stats.workflowBreakdown[session.workflowId][session.status]++;
    });
    
    // Calculate duration statistics
    const completedSessions = recentSessions.filter(s => s.status === 'completed' && s.endTime);
    if (completedSessions.length > 0) {
      const durations = completedSessions.map(s => s.endTime - s.startTime);
      stats.totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
      stats.averageDuration = stats.totalDuration / durations.length;
    }
    
    // Calculate daily statistics
    for (let i = 0; i < days; i++) {
      const dayStart = Date.now() - (i * 24 * 60 * 60 * 1000);
      const dayEnd = dayStart + (24 * 60 * 60 * 1000);
      const dayKey = new Date(dayStart).toISOString().split('T')[0];
      
      const daySessions = recentSessions.filter(s => s.startTime >= dayStart && s.startTime < dayEnd);
      
      stats.dailyStats[dayKey] = {
        total: daySessions.length,
        completed: daySessions.filter(s => s.status === 'completed').length,
        failed: daySessions.filter(s => s.status === 'failed').length
      };
    }
    
    console.log(`[Memory] Generated stats for ${recentSessions.length} sessions`);
    
    return stats;
    
  } catch (error) {
    console.error('[Memory] Error getting workflow stats:', error);
    throw error;
  }
}

/**
 * Clear old sessions from storage
 * @param {Object} payload - The cleanup request payload
 * @param {number} payload.maxAge - Maximum age in days (default: 30)
 * @param {Object} context - Request context
 * @returns {Promise<Object>} Cleanup result
 */
export async function cleanupOldSessions(payload, context) {
  const { maxAge = 30 } = payload || {};
  
  console.log(`[Memory] Cleaning up sessions older than ${maxAge} days`);
  
  try {
    const maxAgeMs = maxAge * 24 * 60 * 60 * 1000;
    await memoryManager.clearOldSessions(maxAgeMs);
    
    console.log('[Memory] Cleanup completed successfully');
    
    return {
      success: true,
      message: `Cleaned up sessions older than ${maxAge} days`,
      timestamp: Date.now()
    };
    
  } catch (error) {
    console.error('[Memory] Error during cleanup:', error);
    throw error;
  }
}