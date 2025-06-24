/**
 * Activates a tab if the provider's configuration enables it for a specific operation.
 * This function supports both 'foreground' activation, which brings the tab to the front,
 * and 'background' activation, which briefly focuses the tab to trigger its logic without
 * disrupting the user's current view.
 *
 * @param {number} tabId - The ID of the tab to be activated.
 * @param {object} config - The provider's configuration object, which contains tab activation settings.
 * @param {string} operation - The type of operation triggering the activation (e.g., 'broadcast', 'harvest').
 * @returns {Promise<void>} A promise that resolves when the activation process is complete.
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
    
    // Check activation mode - background vs foreground
    const activationMode = tabActivation.mode || 'background'; // Default to background
    
    if (activationMode === 'foreground') {
      // Traditional foreground activation - brings tab to front
      if (tab.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
      await chrome.tabs.update(tabId, { active: true });
      console.log(`[Tab Activator] Successfully activated tab ${tabId} in foreground for ${operation}`);
    } else {
      // Background activation - triggers tab without bringing to front
      // This helps ensure the page is "active" for generating content without disrupting user workflow
      
      // Get the currently focused window and its active tab
      const focusedWindow = await chrome.windows.getLastFocused();
      const activeTabsInFocusedWindow = await chrome.tabs.query({ active: true, windowId: focusedWindow.id });
      const originalActiveTab = activeTabsInFocusedWindow[0]; // There should be exactly one active tab per window
      const originalActiveTabId = originalActiveTab?.id;
      const originalWindowId = originalActiveTab?.windowId;
      
      console.log(`[Tab Activator] Background activation: saving current tab ${originalActiveTabId} in window ${originalWindowId}`);
      
      // Momentarily activate the target tab
      await chrome.tabs.update(tabId, { active: true });
      
      // Small delay to allow the tab to register as active and trigger any necessary events
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Switch back to the original tab and window if they exist
      if (originalActiveTabId && originalActiveTabId !== tabId) {
        // First focus the original window if it's different
        if (originalWindowId && originalWindowId !== tab.windowId) {
          await chrome.windows.update(originalWindowId, { focused: true });
        }
        // Then activate the original tab
        await chrome.tabs.update(originalActiveTabId, { active: true });
        console.log(`[Tab Activator] Returned to original tab ${originalActiveTabId} in window ${originalWindowId}`);
      }
      
      console.log(`[Tab Activator] Successfully activated tab ${tabId} in background for ${operation}`);
    }

    // Optional stabilization delay to ensure the tab is fully activated
    if (tabActivation.stabilizationDelay && tabActivation.stabilizationDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, tabActivation.stabilizationDelay));
    }

  } catch (error) {
    console.warn(`[Tab Activator] Failed to activate tab ${tabId}:`, error.message);
    // Don't throw - tab activation failure shouldn't break the main operation
  }
}