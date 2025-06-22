/**
 * Memory Hot Cache Handler
 * 
 * Handles requests for recent workflow sessions from the hot cache
 */

import { MemoryManager } from '../../memory-manager.js';

const memoryManager = new MemoryManager();

/**
 * Get the hot cache containing the most recent workflow sessions
 * @param {Object} payload - Empty payload (hot cache doesn't need parameters)
 * @param {Object} context - Request context
 * @returns {Promise<Array>} Array of recent session records
 */
export async function getHotCache(payload, context) {
  console.log('[Memory] Getting hot cache');
  
  try {
    const hotCache = await memoryManager.getHotCache();
    
    // Return simplified session data for UI performance
    const simplifiedCache = hotCache.map(session => ({
      sessionId: session.sessionId,
      workflowId: session.workflowId,
      status: session.status,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.endTime ? session.endTime - session.startTime : null,
      stepCount: session.steps ? session.steps.length : 0,
      hasError: !!session.error
    }));
    
    console.log(`[Memory] Retrieved ${simplifiedCache.length} sessions from hot cache`);
    
    return {
      sessions: simplifiedCache,
      count: simplifiedCache.length,
      timestamp: Date.now()
    };
    
  } catch (error) {
    console.error('[Memory] Error getting hot cache:', error);
    throw error;
  }
}

/**
 * Get detailed information for a specific session from hot cache
 * @param {Object} payload - The request payload
 * @param {string} payload.sessionId - ID of the session to get details for
 * @param {Object} context - Request context
 * @returns {Promise<Object|null>} Detailed session record or null if not found
 */
export async function getHotCacheSession(payload, context) {
  const { sessionId } = payload;
  
  console.log(`[Memory] Getting session ${sessionId} from hot cache`);
  
  try {
    const hotCache = await memoryManager.getHotCache();
    const session = hotCache.find(s => s.sessionId === sessionId);
    
    if (!session) {
      console.log(`[Memory] Session ${sessionId} not found in hot cache`);
      return null;
    }
    
    console.log(`[Memory] Found session ${sessionId} in hot cache`);
    return session;
    
  } catch (error) {
    console.error(`[Memory] Error getting session ${sessionId} from hot cache:`, error);
    throw error;
  }
}

/**
 * Clear the hot cache
 * @param {Object} payload - Empty payload
 * @param {Object} context - Request context
 * @returns {Promise<Object>} Success confirmation
 */
export async function clearHotCache(payload, context) {
  console.log('[Memory] Clearing hot cache');
  
  try {
    await chrome.storage.session.remove('workflow_hot_cache');
    
    console.log('[Memory] Hot cache cleared successfully');
    
    return {
      success: true,
      message: 'Hot cache cleared',
      timestamp: Date.now()
    };
    
  } catch (error) {
    console.error('[Memory] Error clearing hot cache:', error);
    throw error;
  }
}