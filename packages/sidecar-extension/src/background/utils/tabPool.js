// TabPool Manager - Phase 2 Implementation
// Manages the lifecycle of worker tabs with state tracking and health monitoring

import { configManager } from './configManager.js';
import { PING } from '@hybrid-thinking/messaging';

// Tab states
const TAB_STATES = {
  CREATING: 'CREATING',
  IDLE: 'IDLE', 
  BUSY: 'BUSY',
  ERROR: 'ERROR'
};

/**
 * Manages a pool of worker tabs for different providers.
 * Handles tab creation, reuse, adoption, and health monitoring.
 */
class TabPool {
  /**
   * Initializes the TabPool instance.
   */
  constructor() {
    this.tabs = new Map(); // tabId -> { tabId, providerKey, state, lastPing, url }
    this.healthCheckInterval = null;
    this.isInitialized = false;
  }

  /**
   * Initializes the tab pool manager, starting health monitoring.
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('[TabPool] Initializing tab pool manager');
    
    // Start health monitoring
    this.startHealthMonitoring();
    
    this.isInitialized = true;
    console.log('[TabPool] Tab pool manager initialized');
  }

  /**
   * Acquires a worker tab for a given provider, following a priority order:
   * 1. Reuse an idle tab from the pool.
   * 2. Discover and adopt a user-opened tab.
   * 3. Create a new worker tab.
   * @param {string} providerKey - The key of the provider (e.g., 'chatgpt').
   * @returns {Promise<object>} A promise that resolves with the acquired tab object.
   */
  async getWorkerTab(providerKey) {
    console.log(`[TabPool] Acquiring worker tab for provider: ${providerKey}`);
    
    // 1. Try to reuse from pool
    const idleTab = this.findIdleTab(providerKey);
    if (idleTab) {
      console.log(`[TabPool] Reusing idle tab ${idleTab.tabId} for ${providerKey}`);
      this.updateTabState(idleTab.tabId, TAB_STATES.BUSY);
      return idleTab;
    }
    
    // 2. Try to discover and adopt user-opened tab
    const adoptedTab = await this.discoverAndAdoptTab(providerKey);
    if (adoptedTab) {
      console.log(`[TabPool] Adopted user tab ${adoptedTab.tabId} for ${providerKey}`);
      this.updateTabState(adoptedTab.tabId, TAB_STATES.BUSY);
      return adoptedTab;
    }
    
    // 3. Create new worker tab
    const newTab = await this.createWorkerTab(providerKey);
    console.log(`[TabPool] Created new worker tab ${newTab.tabId} for ${providerKey}`);
    this.updateTabState(newTab.tabId, TAB_STATES.BUSY);
    return newTab;
  }

  /**
   * Finds an idle tab in the pool for a specific provider.
   * @param {string} providerKey - The key of the provider.
   * @returns {object|null} The idle tab object or null if not found.
   */
  findIdleTab(providerKey) {
    for (const tab of this.tabs.values()) {
      if (tab.providerKey === providerKey && tab.state === TAB_STATES.IDLE) {
        return tab;
      }
    }
    return null;
  }

  /**
   * Scans for user-opened tabs that match the provider's URL and adopts one into the pool.
   * @param {string} providerKey - The key of the provider.
   * @returns {Promise<object|null>} A promise that resolves with the adopted tab object or null.
   */
  async discoverAndAdoptTab(providerKey) {
    try {
      const config = await configManager.getConfig(providerKey);
      if (!config || !config.baseUrl) {
        console.warn(`[TabPool] No base URL configured for provider: ${providerKey}`);
        return null;
      }
      
      // Query all tabs matching the provider's domain
      const tabs = await chrome.tabs.query({ url: `${config.baseUrl}*` });
      
      for (const tab of tabs) {
        // Skip tabs already in our pool
        if (this.tabs.has(tab.id)) continue;
        
        // Check if tab is responsive
        const isResponsive = await this.pingTab(tab.id);
        if (isResponsive) {
          // Adopt this tab into our pool
          const adoptedTab = {
            tabId: tab.id,
            providerKey,
            state: TAB_STATES.IDLE,
            lastPing: Date.now(),
            url: tab.url
          };
          
          this.tabs.set(tab.id, adoptedTab);
          return adoptedTab;
        }
      }
    } catch (error) {
      console.error(`[TabPool] Error discovering tabs for ${providerKey}:`, error);
    }
    
    return null;
  }

  /**
   * Creates a new, pinned, non-focused worker tab for the specified provider.
   * @param {string} providerKey - The key of the provider.
   * @returns {Promise<object>} A promise that resolves with the newly created tab object.
   */
  async createWorkerTab(providerKey) {
    try {
      const config = await configManager.getConfig(providerKey);
      if (!config || !config.baseUrl) {
        throw new Error(`No base URL configured for provider: ${providerKey}`);
      }
      
      // Create new tab
      const tab = await chrome.tabs.create({
        url: config.baseUrl,
        active: false, // Non-focused
        pinned: true   // Pinned
      });
      
      // Add to pool with CREATING state
      const poolTab = {
        tabId: tab.id,
        providerKey,
        state: TAB_STATES.CREATING,
        lastPing: Date.now(),
        url: tab.url
      };
      
      this.tabs.set(tab.id, poolTab);
      
      // Wait for tab to be ready
      await this.waitForTabReady(tab.id);
      
      // Update state to IDLE
      this.updateTabState(tab.id, TAB_STATES.IDLE);
      
      return poolTab;
    } catch (error) {
      console.error(`[TabPool] Error creating worker tab for ${providerKey}:`, error);
      throw error;
    }
  }

  /**
   * Waits for a tab to be fully loaded and responsive.
   * @param {number} tabId - The ID of the tab to wait for.
   * @param {number} [timeout=30000] - The maximum time to wait in milliseconds.
   * @returns {Promise<boolean>} A promise that resolves with true if the tab becomes ready.
   * @throws {Error} If the tab does not become ready within the timeout period.
   */
  async waitForTabReady(tabId, timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === 'complete') {
          // Additional check: try to ping the tab
          const isResponsive = await this.pingTab(tabId);
          if (isResponsive) {
            return true;
          }
        }
      } catch (error) {
        console.warn(`[TabPool] Tab ${tabId} not ready yet:`, error.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Tab ${tabId} did not become ready within ${timeout}ms`);
  }

  /**
   * Updates the state of a tab in the pool.
   * @param {number} tabId - The ID of the tab to update.
   * @param {string} newState - The new state for the tab (e.g., 'IDLE', 'BUSY').
   */
  updateTabState(tabId, newState) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.state = newState;
      tab.lastPing = Date.now();
      console.log(`[TabPool] Tab ${tabId} state updated to: ${newState}`);
    }
  }

  /**
   * Releases a tab, marking it as idle and available for reuse.
   * @param {number} tabId - The ID of the tab to release.
   */
  releaseTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (tab && tab.state === TAB_STATES.BUSY) {
      this.updateTabState(tabId, TAB_STATES.IDLE);
      console.log(`[TabPool] Released tab ${tabId} back to idle`);
    }
  }

  /**
   * Marks a tab as being in an error state.
   * @param {number} tabId - The ID of the tab.
   * @param {Error} error - The error that occurred.
   */
  markTabError(tabId, error) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      this.updateTabState(tabId, TAB_STATES.ERROR);
      console.error(`[TabPool] Tab ${tabId} marked as error:`, error);
      
      // Schedule cleanup
      setTimeout(() => this.cleanupErrorTab(tabId), 5000);
    }
  }

  /**
   * Removes a tab from the pool and closes it.
   * @param {number} tabId - The ID of the tab to remove.
   */
  async removeTab(tabId) {
    try {
      await chrome.tabs.remove(tabId);
      this.tabs.delete(tabId);
      console.log(`[TabPool] Cleaned up error tab ${tabId}`);
    } catch (error) {
      console.warn(`[TabPool] Failed to cleanup tab ${tabId}:`, error.message);
      // Remove from pool anyway
      this.tabs.delete(tabId);
    }
  }

  /**
   * Pings a tab to check if it is responsive.
   * @param {number} tabId - The ID of the tab to ping.
   * @param {number} [timeout=5000] - The maximum time to wait for a response.
   * @returns {Promise<boolean>} A promise that resolves with true if the tab is responsive.
   */
  async pingTab(tabId, timeout = 5000) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: PING });
      return response && response.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Starts the periodic health monitoring of all tabs in the pool.
   * @param {number} [interval=60000] - The interval in milliseconds for health checks.
   */
  startHealthMonitoring(interval = 60000) {
    if (this.healthCheckInterval) return;
    
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Check every 30 seconds
    
    console.log('[TabPool] Health monitoring started');
  }

  /**
   * Performs a health check on all tabs in the pool, removing unresponsive ones.
   * @private
   */
  async healthCheck() {
    console.log(`[TabPool] Performing health check on ${this.tabs.size} tabs`);
    
    const healthPromises = [];
    
    for (const [tabId, tab] of this.tabs.entries()) {
      // Skip tabs that are currently busy or already in error state
      if (tab.state === TAB_STATES.BUSY || tab.state === TAB_STATES.ERROR) {
        continue;
      }
      
      healthPromises.push(this.checkTabHealth(tabId));
    }
    
    await Promise.allSettled(healthPromises);
  }

  /**
   * Checks the health of a specific tab.
   * @param {number} tabId - The ID of the tab to check.
   * @private
   */
  async checkTabHealth(tabId) {
    try {
      // First check if tab still exists
      const tab = await chrome.tabs.get(tabId);
      if (!tab) {
        this.tabs.delete(tabId);
        return;
      }
      
      // Then ping for responsiveness
      const isResponsive = await this.pingTab(tabId);
      if (!isResponsive) {
        console.warn(`[TabPool] Tab ${tabId} is unresponsive`);
        this.markTabError(tabId, 'Unresponsive to ping');
      } else {
        // Update last ping time
        const poolTab = this.tabs.get(tabId);
        if (poolTab) {
          poolTab.lastPing = Date.now();
        }
      }
    } catch (error) {
      console.warn(`[TabPool] Health check failed for tab ${tabId}:`, error.message);
      // Tab probably doesn't exist anymore
      this.tabs.delete(tabId);
    }
  }

  /**
   * Retrieves statistics about the current state of the tab pool.
   *
   * @returns {object} An object containing tab pool statistics.
   */
  getStats() {
    const stats = {
      total: this.tabs.size,
      creating: 0,
      idle: 0,
      busy: 0,
      error: 0
    };
    
    for (const tab of this.tabs.values()) {
      stats[tab.state.toLowerCase()]++;
    }
    
    return stats;
  }

  /**
   * Stops the health monitoring service.
   */
  stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    console.log('[TabPool] Tab pool manager destroyed');
  }
}

// Export singleton instance
export const tabPool = new TabPool();
export { TAB_STATES };

// Legacy compatibility exports
export async function getWorkerTab(providerKey) {
  const tab = await tabPool.getWorkerTab(providerKey);
  return tab.tabId;
}

export function releaseWorkerTab(providerKey, tabId) {
  tabPool.releaseTab(tabId);
}