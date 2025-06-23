/**
 * Memory Manager - Handles tiered storage for workflow sessions
 * 
 * Implements a dual storage strategy:
 * - Hot Cache: chrome.storage.session (5-10 recent items, <100ms access)
 * - Cold Storage: chrome.storage.local (complete history, on-demand loading)
 */

const HOT_CACHE_KEY = 'workflow_hot_cache';
const PROMPT_CACHE_KEY = 'prompt_hot_cache';
const COLD_STORAGE_PREFIX = 'workflow_session_';
const MAX_HOT_CACHE_SIZE = 10;
const MAX_PROMPT_CACHE_SIZE = 10;

export class MemoryManager {
  constructor() {
    this.hotCacheInitialized = false;
    this.promptCacheInitialized = false;
  }

  /**
   * Initialize hot cache if not already done
   */
  async #ensureHotCacheInitialized() {
    if (this.hotCacheInitialized) return;
    
    try {
      const result = await chrome.storage.session.get(HOT_CACHE_KEY);
      if (!result[HOT_CACHE_KEY]) {
        await chrome.storage.session.set({ [HOT_CACHE_KEY]: [] });
      }
      this.hotCacheInitialized = true;
    } catch (error) {
      console.error('[MemoryManager] Failed to initialize hot cache:', error);
      throw error;
    }
  }

  /**
   * Initialize prompt cache if not already done
   */
  async #ensurePromptCacheInitialized() {
    if (this.promptCacheInitialized) return;
    
    try {
      const result = await chrome.storage.session.get(PROMPT_CACHE_KEY);
      if (!result[PROMPT_CACHE_KEY]) {
        await chrome.storage.session.set({ [PROMPT_CACHE_KEY]: {} });
      }
      this.promptCacheInitialized = true;
    } catch (error) {
      console.error('[MemoryManager] Failed to initialize prompt cache:', error);
      throw error;
    }
  }

  /**
   * Save a session record to both hot cache and cold storage
   * @param {Object} sessionRecord - The session record to save
   */
  async saveSession(sessionRecord) {
    console.log(`[MemoryManager] Saving session ${sessionRecord.sessionId}`);
    
    try {
      await this.#ensureHotCacheInitialized();
      
      // Atomic write to both storages
      await Promise.all([
        this.#saveToHotCache(sessionRecord),
        this.#saveToColdStorage(sessionRecord)
      ]);
      
      console.log(`[MemoryManager] Successfully saved session ${sessionRecord.sessionId}`);
    } catch (error) {
      console.error(`[MemoryManager] Failed to save session ${sessionRecord.sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific session by ID
   * @param {string} sessionId - The session ID to retrieve
   * @returns {Promise<Object|null>} The session record or null if not found
   */
  async getSession(sessionId) {
    console.log(`[MemoryManager] Getting session ${sessionId}`);
    
    try {
      // First check hot cache for recent sessions
      const hotCache = await this.getHotCache();
      const hotSession = hotCache.find(session => session.sessionId === sessionId);
      
      if (hotSession) {
        console.log(`[MemoryManager] Found session ${sessionId} in hot cache`);
        return hotSession;
      }
      
      // If not in hot cache, check cold storage
      const coldSession = await this.#getFromColdStorage(sessionId);
      if (coldSession) {
        console.log(`[MemoryManager] Found session ${sessionId} in cold storage`);
        return coldSession;
      }
      
      console.log(`[MemoryManager] Session ${sessionId} not found`);
      return null;
      
    } catch (error) {
      console.error(`[MemoryManager] Failed to get session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get the hot cache (5-10 most recent sessions)
   * @returns {Promise<Array>} Array of recent session records
   */
  async getHotCache() {
    try {
      await this.#ensureHotCacheInitialized();
      
      const result = await chrome.storage.session.get(HOT_CACHE_KEY);
      return result[HOT_CACHE_KEY] || [];
      
    } catch (error) {
      console.error('[MemoryManager] Failed to get hot cache:', error);
      return [];
    }
  }

  /**
   * Get the complete history from cold storage
   * @param {number} limit - Maximum number of sessions to return (default: 100)
   * @param {number} offset - Number of sessions to skip (default: 0)
   * @returns {Promise<Array>} Array of all session records
   */
  async getFullHistory(limit = 100, offset = 0) {
    console.log(`[MemoryManager] Getting full history (limit: ${limit}, offset: ${offset})`);
    
    try {
      // Get all workflow session keys
      const allKeys = await chrome.storage.local.get(null);
      const sessionKeys = Object.keys(allKeys)
        .filter(key => key.startsWith(COLD_STORAGE_PREFIX))
        .sort((a, b) => {
          // Sort by timestamp (newest first)
          const sessionA = allKeys[a];
          const sessionB = allKeys[b];
          return (sessionB.startTime || 0) - (sessionA.startTime || 0);
        })
        .slice(offset, offset + limit);
      
      // Get the session records
      const sessions = sessionKeys.map(key => allKeys[key]);
      
      console.log(`[MemoryManager] Retrieved ${sessions.length} sessions from full history`);
      return sessions;
      
    } catch (error) {
      console.error('[MemoryManager] Failed to get full history:', error);
      return [];
    }
  }

  /**
   * Clear old sessions from both hot cache and cold storage
   * @param {number} maxAge - Maximum age in milliseconds (default: 30 days)
   */
  async clearOldSessions(maxAge = 30 * 24 * 60 * 60 * 1000) {
    console.log('[MemoryManager] Clearing old sessions');
    
    try {
      const cutoffTime = Date.now() - maxAge;
      
      // Clear from cold storage
      const allKeys = await chrome.storage.local.get(null);
      const keysToRemove = [];
      
      for (const [key, session] of Object.entries(allKeys)) {
        if (key.startsWith(COLD_STORAGE_PREFIX) && 
            session.startTime && 
            session.startTime < cutoffTime) {
          keysToRemove.push(key);
        }
      }
      
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        console.log(`[MemoryManager] Removed ${keysToRemove.length} old sessions`);
      }
      
      // Hot cache is automatically managed by session storage lifecycle
      
    } catch (error) {
      console.error('[MemoryManager] Failed to clear old sessions:', error);
    }
  }

  /**
   * Save session to hot cache with automatic trimming
   */
  async #saveToHotCache(sessionRecord) {
    const hotCache = await this.getHotCache();
    
    // Remove existing entry if it exists
    const existingIndex = hotCache.findIndex(s => s.sessionId === sessionRecord.sessionId);
    if (existingIndex !== -1) {
      hotCache.splice(existingIndex, 1);
    }
    
    // Add to front (most recent)
    hotCache.unshift(sessionRecord);
    
    // Trim to max size
    if (hotCache.length > MAX_HOT_CACHE_SIZE) {
      hotCache.splice(MAX_HOT_CACHE_SIZE);
    }
    
    await chrome.storage.session.set({ [HOT_CACHE_KEY]: hotCache });
  }

  /**
   * Save session to cold storage
   */
  async #saveToColdStorage(sessionRecord) {
    const key = `${COLD_STORAGE_PREFIX}${sessionRecord.sessionId}`;
    await chrome.storage.local.set({ [key]: sessionRecord });
  }

  /**
   * Get session from cold storage
   */
  async #getFromColdStorage(sessionId) {
    const key = `${COLD_STORAGE_PREFIX}${sessionId}`;
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  }

  /**
   * Save a single prompt-response pair to the cache, organized by provider
   * @param {string} providerKey - The key for the provider (e.g., 'chatgpt')
   * @param {string} prompt - The user's prompt text
   * @param {string} response - The AI's response text
   */
  async savePromptOutput(providerKey, prompt, response) {
    console.log(`[MemoryManager] Saving prompt output for ${providerKey}`);
    
    try {
      await this.#ensurePromptCacheInitialized();
      
      const promptCache = await this.getPromptCache();
      
      if (!promptCache[providerKey]) {
        promptCache[providerKey] = [];
      }
      
      const newOutput = {
        id: crypto.randomUUID(),
        prompt: prompt,
        response: response,
        timestamp: new Date().toISOString()
      };
      
      // Add to front (most recent)
      promptCache[providerKey].unshift(newOutput);
      
      // Trim to max size
      if (promptCache[providerKey].length > MAX_PROMPT_CACHE_SIZE) {
        promptCache[providerKey].splice(MAX_PROMPT_CACHE_SIZE);
      }
      
      await chrome.storage.session.set({ [PROMPT_CACHE_KEY]: promptCache });
      console.log(`[MemoryManager] Saved new prompt output for ${providerKey} to hot cache.`);
      
    } catch (error) {
      console.error(`[MemoryManager] Failed to save prompt output for ${providerKey}:`, error);
      throw error;
    }
  }

  /**
   * Get the prompt cache (recent prompt-response pairs by provider)
   * @returns {Promise<Object>} Object with provider keys and arrays of prompt outputs
   */
  async getPromptCache() {
    try {
      await this.#ensurePromptCacheInitialized();
      
      const result = await chrome.storage.session.get(PROMPT_CACHE_KEY);
      return result[PROMPT_CACHE_KEY] || {};
      
    } catch (error) {
      console.error('[MemoryManager] Failed to get prompt cache:', error);
      return {};
    }
  }

  /**
   * Get the complete hot cache including both workflows and prompts
   * @returns {Promise<Object>} Object with recentWorkflows and recentPromptOutputs
   */
  async getCompleteHotCache() {
    try {
      const [workflows, prompts] = await Promise.all([
        this.getHotCache(),
        this.getPromptCache()
      ]);
      
      return {
        recentWorkflows: workflows,
        recentPromptOutputs: prompts
      };
      
    } catch (error) {
      console.error('[MemoryManager] Failed to get complete hot cache:', error);
      return {
        recentWorkflows: [],
        recentPromptOutputs: {}
      };
    }
  }

  /**
   * Get storage usage statistics
   * @returns {Promise<Object>} Storage usage information
   */
  async getStorageStats() {
    try {
      const [sessionUsage, localUsage] = await Promise.all([
        chrome.storage.session.getBytesInUse(),
        chrome.storage.local.getBytesInUse()
      ]);
      
      const hotCache = await this.getHotCache();
      const promptCache = await this.getPromptCache();
      const allLocalKeys = await chrome.storage.local.get(null);
      const sessionCount = Object.keys(allLocalKeys)
        .filter(key => key.startsWith(COLD_STORAGE_PREFIX)).length;
      
      return {
        hotCache: {
          count: hotCache.length,
          bytesUsed: sessionUsage
        },
        promptCache: {
          count: Object.values(promptCache).reduce((total, arr) => total + arr.length, 0),
          providers: Object.keys(promptCache).length
        },
        coldStorage: {
          count: sessionCount,
          bytesUsed: localUsage
        }
      };
      
    } catch (error) {
      console.error('[MemoryManager] Failed to get storage stats:', error);
      return { 
        hotCache: { count: 0, bytesUsed: 0 }, 
        promptCache: { count: 0, providers: 0 },
        coldStorage: { count: 0, bytesUsed: 0 } 
      };
    }
  }
}