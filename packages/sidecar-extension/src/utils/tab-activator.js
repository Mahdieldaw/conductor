/**
 * Activates a tab if configured to do so based on provider configuration.
 * @param {number} tabId - The ID of the tab to activate
 * @param {object} config - The provider configuration object
 * @param {string} operation - The operation type ('broadcast', 'harvest', 'readiness')
 * @returns {Promise<void>}
 */
export async function activateTabIfConfigured(tabId, config, operation) {
  // Check if tab activation is configured for this provider
  const tabActivation = config?.tabActivation;
  if (!tabActivation?.enabled) {
    return; // Tab activation is disabled
  }

  // Check if activation is enabled for this specific operation
  const shouldActivate = {
    broadcast: tabActivation.activateOnBroadcast,
    harvest: tabActivation.activateOnHarvest,
    readiness: tabActivation.activateOnReadinessCheck
  }[operation];

  if (!shouldActivate) {
    return; // Tab activation is disabled for this operation
  }

  try {
    // Get the tab to check if it exists and get window info
    const tab = await chrome.tabs.get(tabId);
    
    // Focus the window first (required for tab activation to work properly)
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }

    // Activate the tab
    await chrome.tabs.update(tabId, { active: true });

    // Optional stabilization delay to ensure the tab is fully activated
    if (tabActivation.stabilizationDelay && tabActivation.stabilizationDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, tabActivation.stabilizationDelay));
    }

    console.log(`[Tab Activator] Successfully activated tab ${tabId} for ${operation}`);
  } catch (error) {
    console.warn(`[Tab Activator] Failed to activate tab ${tabId}:`, error.message);
    // Don't throw - tab activation failure shouldn't break the main operation
  }
}