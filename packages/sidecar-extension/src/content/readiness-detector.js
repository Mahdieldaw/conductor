// Lightweight readiness detector content script
// This script exposes window.hybrid.checkReadiness() on all target pages
// It's designed to be minimal, fast-loading, and always available

(function() {
  'use strict';

  // Ensure we don't double-initialize
  if (window.hybrid && window.hybrid.checkReadiness) {
    console.log('[Readiness Detector] Already initialized');
    return;
  }

  // Create the hybrid namespace
  window.hybrid = window.hybrid || {};

  /**
   * Lightweight readiness check function
   * @param {Object} config - Provider configuration with selectors
   * @returns {Object} Readiness status object
   */
  window.hybrid.checkReadiness = function(config) {
    const { selectors, platformKey, name } = config;
    
    console.log(`[Readiness Detector - ${platformKey}] Checking readiness markers`);

    try {
      // Helper function to safely query selectors
      const querySelector = (selector) => {
        try {
          return document.querySelector(selector);
        } catch (error) {
          console.warn(`[Readiness Detector - ${platformKey}] Invalid selector: ${selector}`);
          return null;
        }
      };

      // Rule 1: Check if the ready marker (prompt input) is present
      const isReadyMarkerPresent = selectors.readyMarker && querySelector(selectors.readyMarker);
      
      if (isReadyMarkerPresent) {
        console.log(`[Readiness Detector - ${platformKey}] Found ready marker. Status: READY`);
        return {
          success: true,
          status: 'READY',
          message: `${name} is ready for prompts.`
        };
      }

      // Rule 2: Check if login marker is present (user needs to authenticate)
      const isLoginMarkerPresent = selectors.loginMarker && querySelector(selectors.loginMarker);
      
      if (isLoginMarkerPresent) {
        console.log(`[Readiness Detector - ${platformKey}] Found login marker. Status: LOGIN_REQUIRED`);
        return {
          success: true,
          status: 'LOGIN_REQUIRED',
          message: `Please log in to ${name} to continue.`
        };
      }

      // Rule 3: Neither marker found - unknown state
      const errorMessage = `Could not determine page state for ${platformKey}. Neither ready marker nor login marker was found.`;
      console.warn(`[Readiness Detector - ${platformKey}] ${errorMessage}`);
      
      return {
        success: false,
        status: 'SERVICE_ERROR',
        error: errorMessage
      };

    } catch (error) {
      console.error(`[Readiness Detector - ${platformKey}] Unexpected error:`, error);
      return {
        success: false,
        status: 'SERVICE_ERROR',
        error: `Readiness check failed: ${error.message}`
      };
    }
  };

  console.log('[Readiness Detector] Initialized successfully');
})();