// provider.js - Production-Grade Concurrent Harvest Engine
// Updated to use centralized DOM utilities and configuration management

import { 
  querySelector, 
  waitForElement, 
  simulateInput, 
  simulateClick, 
  abortableDelay,
  extractTextContent 
} from './utils/dom-utils.js';

export class Provider {
  /**
   * Creates an instance of the Provider.
   * @param {object} config - The configuration for the provider.
   */
  constructor(config) { // Accepts config as argument
    if (!config) {
      throw new Error("Provider was initialized without a valid configuration.");
    }
    this.config = config;
    this.activeControllers = new Set(); // Track active abort controllers
    console.log(`[Sidecar Provider] Initialized with config for: ${this.config.platformKey}`);
  }

  // Unified broadcast method with normalized response structure and metadata
    /**
   * Broadcasts a prompt to the provider's website.
   * @param {string} prompt - The prompt to broadcast.
   * @returns {Promise<{success: boolean}>} A promise that resolves when the broadcast is complete.
   */
  async broadcast(prompt) {
    const { platformKey, broadcastStrategy, selectors } = this.config;
    console.log(`[Sidecar Broadcast - ${platformKey}] Executing ${broadcastStrategy.length}-step strategy.`);

    for (const step of broadcastStrategy) {
      // Destructure all possible properties from the config step
      const { action, target, value, ms, timeout, retry } = step;
      const cssSelectorList = target ? selectors[target] : null;

      console.log(`[Sidecar Broadcast - ${platformKey}] --> STEP: ${action} on target '${target || 'N/A'}'`);

      try {
        switch (action) {
          case 'fill': {
            if (!cssSelectorList) throw new Error(`No selectors defined for target: ${target}`);
            // Use the timeout from the JSON config, with a sensible default.
            const el = await waitForElement(cssSelectorList, timeout || this.config.timing?.broadcastFillTimeout || 7000);
            simulateInput(el, value.replace('{{prompt}}', prompt));
            break;
          }

          case 'click': {
            if (!cssSelectorList) throw new Error(`No selectors defined for target: ${target}`);
            // Use the timeout from the JSON config.
            const el = await waitForElement(cssSelectorList, timeout || this.config.timing?.broadcastClickTimeout || 5000);
            simulateClick(el, { checkDisabled: true });
            break;
          }

          case 'wait': {
            if (!ms) throw new Error("'wait' action requires an 'ms' property in config.");
            await new Promise(r => setTimeout(r, ms));
            break;
          }

          default:
            throw new Error(`Unknown action in broadcastStrategy: '${action}'`);
        }
        console.log(`[Sidecar Broadcast - ${platformKey}] <-- SUCCESS: ${action}`);
      } catch (error) {
        const errorMessage = `Broadcast failed at step '${action}' on target '${target}'. Reason: ${error.message}`;
        console.error(`[Sidecar Broadcast - ${platformKey}] ${errorMessage}`);
        
        // Re-throw to ensure the promise rejects and the failure is not silent.
        throw new Error(errorMessage);
      }
    }

    // This is only reached if every step in the strategy succeeds.
    return { success: true };
  }

  /**
   * Main harvest dispatcher. It reads the "method" from the JSON config
   * and delegates to the appropriate strategy. This is the public entry point.
   * Includes a 45-second final scrape fallback that triggers regardless of strategy success/failure.
   */
    /**
   * Harvests the response from the provider's website.
   * @returns {Promise<object>} A promise that resolves with the harvested content and metadata.
   */
  async harvest() {
    const { harvestStrategy, platformKey } = this.config;
    console.log(`[Sidecar Harvest - ${platformKey}] Dispatching with method: '${harvestStrategy.method}'`);
    if (!harvestStrategy?.method) {
      return this.#createErrorResult('No harvestStrategy.method defined in config.');
    }
    const startTime = performance.now();
    
    // Set up 30-second final scrape fallback
     const finalScrapeTimeout = 30000; // 30 seconds
    const finalScrapePromise = new Promise(async (resolve) => {
      await new Promise(r => setTimeout(r, finalScrapeTimeout));
      console.log(`[Sidecar Harvest - ${platformKey}] ⏰ 30-second timeout reached, performing final scrape attempt`);
      try {
        const finalResult = await this.#performScrape();
        if (finalResult && finalResult.trim()) {
          const duration = performance.now() - startTime;
          resolve(this.#enrichResult({
            success: true,
            content: finalResult,
            meta: { strategy: 'final-scrape-timeout', source: 'timeout-fallback' }
          }, { duration, method: `${harvestStrategy.method}-with-final-scrape` }));
        } else {
          const duration = performance.now() - startTime;
          resolve(this.#createErrorResult('Final scrape at 30s returned no content', { duration, method: harvestStrategy.method }));
        }
      } catch (error) {
        const duration = performance.now() - startTime;
        resolve(this.#createErrorResult(`Final scrape failed: ${error.message}`, { duration, method: harvestStrategy.method }));
      }
    });
    
    // Execute primary strategy
    const primaryStrategyPromise = (async () => {
      try {
        let result;
        switch (harvestStrategy.method) {
          case 'observer':
            // This is the most reliable method when a completion marker is available.
            result = await this.#executeStrategy('observer', () => this.#harvestWithObserver());
            break;
          case 'concurrent':
          case 'race':
            result = await this.#executeConcurrentHarvest();
            break;
          case 'poll':
            result = await this.#executeStrategy('polling', () => this.#harvestWithPolling());
            break;
          default:
            // Default to polling if no specific or reliable method is defined.
            console.log(`[Sidecar Harvest - ${platformKey}] Method not specified or unknown, defaulting to 'poll'.`);
            result = await this.#executeStrategy('polling', () => this.#harvestWithPolling());
            break;
        }
        const duration = performance.now() - startTime;
        return this.#enrichResult(result, { duration, method: harvestStrategy.method });
      } catch (error) {
        const duration = performance.now() - startTime;
        return this.#createErrorResult(error.message || String(error), { duration, method: harvestStrategy.method });
      }
    })();
    
    // Race between primary strategy and final scrape timeout
    try {
      const result = await Promise.race([primaryStrategyPromise, finalScrapePromise]);
      console.log(`[Sidecar Harvest - ${platformKey}] ✅ Harvest completed with strategy: ${result.meta?.strategy || 'unknown'}`);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      return this.#createErrorResult(error.message || String(error), { duration, method: harvestStrategy.method });
    }
  }

  /**
   * Clicks the "New Chat" button based on the configuration.
   * This is called by the session manager to reset the context.
   */
    /**
   * Starts a new chat on the provider's website.
   * @returns {Promise<{success: boolean}>} A promise that resolves when the new chat is started.
   */
  async startNewChat() {
    const { platformKey, selectors } = this.config;
    const newChatSelectors = selectors.newChat;

    if (!newChatSelectors || newChatSelectors.length === 0) {
      console.warn(`[Sidecar NewChat - ${platformKey}] No 'newChat' selectors defined in config. Skipping.`);
      // Return success because there's nothing to do.
      return { success: true };
    }

    console.log(`[Sidecar NewChat - ${platformKey}] Attempting to start a new chat.`);
    try {
      const newChatButton = await waitForElement(newChatSelectors, this.config.timing?.newChatTimeout || 5000);
      if (newChatButton) {
        simulateClick(newChatButton);
        console.log(`[Sidecar NewChat - ${platformKey}] ✅ Clicked 'new chat' button.`);
        // Allow a brief moment for the UI to update
        await abortableDelay(this.config.timing?.newChatStabilizationDelay || 300);
        return { success: true };
      }
      throw new Error("'New Chat' button not found with provided selectors.");
    } catch (error) {
      const errorMessage = `Failed to start new chat. Reason: ${error.message}`;
      console.error(`[Sidecar NewChat - ${platformKey}] ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  /**
   * Runs polling and observer strategies in parallel and returns the first
   * successful result, cancelling the other. This is the most resilient approach.
   */
  async #executeConcurrentHarvest() {
    const { platformKey } = this.config;
    console.log(`[Sidecar Harvest - ${platformKey}] Starting concurrent harvest (polling vs observer)`);
    const pollingController = new AbortController();
    const observerController = new AbortController();
    this.activeControllers.add(pollingController);
    this.activeControllers.add(observerController);

    const pollingPromise = this.#executeStrategy('polling', 
      () => this.#harvestWithPolling(pollingController.signal),
      pollingController
    );
    const observerPromise = this.#executeStrategy('observer', 
      () => this.#harvestWithObserver(observerController.signal),
      observerController
    );

    try {
      const result = await Promise.race([pollingPromise, observerPromise]);
      this.#cancelRemainingControllers([pollingController, observerController]);
      console.log(`[Sidecar Harvest - ${platformKey}] ✅ Concurrent harvest completed, winner: ${result.meta?.strategy}`);
      return result;
    } catch (error) {
      this.#cancelRemainingControllers([pollingController, observerController]);
      throw error;
    }
  }

  /**
   * A wrapper to execute a single strategy, handling cancellation and normalization.
   */
  async #executeStrategy(strategyName, executor, controller = null) {
    const { platformKey } = this.config;
    try {
      const rawResult = await executor();
      if (controller?.signal.aborted) {
        return this.#createErrorResult(`${strategyName} strategy was cancelled`);
      }
      return this.#normalizeResult(rawResult, strategyName);
    } catch (error) {
      if (error.name === 'AbortError' || controller?.signal.aborted) {
        console.log(`[Sidecar Harvest - ${platformKey}] ${strategyName} strategy cancelled`);
        return this.#createErrorResult(`${strategyName} strategy was cancelled`);
      }
      console.warn(`[Sidecar Harvest - ${platformKey}] ${strategyName} strategy failed:`, error.message);
      return this.#createErrorResult(error.message || String(error), { strategy: strategyName });
    }
  }

  /**
   * The polling strategy: repeatedly checks the DOM for completion markers.
   * Driven by 'maxAttempts', 'baseDelay', and 'backoffMultiplier' from the config.
   */
  async #harvestWithPolling(signal = null) {
    const { platformKey, harvestStrategy, selectors } = this.config;
    console.log(`[Sidecar Harvest - ${platformKey}] Starting polling harvest.`);
    
    // Phase 1: Wait for streaming to stop with time-based timeout
    console.log(`[Sidecar Harvest - ${platformKey}] Phase 1: Waiting for streaming to stop...`);
    const phase1Timeout = this.config.timing?.pollingPhase1Timeout || 45000; // 45 seconds like observer
    const phase1StartTime = Date.now();
    let attempt = 0;
    
    while (Date.now() - phase1StartTime < phase1Timeout) {
      if (signal?.aborted) throw new Error('Polling aborted');

      // Check if streaming has stopped
      const checks = harvestStrategy.completionChecks || [{ type: 'absence', target: 'streamingIndicator' }];
      let streamingStopped = true;
      for (const check of checks) {
        const list = selectors[check.target];
        if (!list) continue; // Skip if selector for check is not defined
        if (check.type === 'absence' && querySelector(list)) { 
          streamingStopped = false; break; 
        }
        if (check.type === 'presence' && !querySelector(list)) { 
          streamingStopped = false; break; 
        }
      }

      if (streamingStopped) {
        console.log(`[Sidecar Harvest - ${platformKey}] ✅ Streaming stopped after ${Date.now() - phase1StartTime}ms (attempt ${attempt + 1})`);
        break; // Move to Phase 2
      }
      
      const delay = (harvestStrategy.baseDelay || 500) * Math.pow(harvestStrategy.backoffMultiplier || 1.2, Math.min(attempt, 10));
      await abortableDelay(delay, signal);
      attempt++;
    }

    if (Date.now() - phase1StartTime >= phase1Timeout) {
      throw new Error(`Phase 1 failed: Streaming did not stop after ${phase1Timeout}ms timeout.`);
    }

    // Phase 2: Look for completion markers with tight polling
    console.log(`[Sidecar Harvest - ${platformKey}] Phase 2: Checking for completion markers...`);
    const completionMarkerSelector = selectors.completionMarker;
    if (completionMarkerSelector) {
      const markerCheckAttempts = this.config.timing?.markerCheckAttempts || 25; // 5 seconds at 200ms intervals
      for (let markerAttempt = 0; markerAttempt < markerCheckAttempts; markerAttempt++) {
        if (signal?.aborted) throw new Error('Polling aborted');
        
        if (querySelector(completionMarkerSelector)) {
          console.log(`[Sidecar Harvest - ${platformKey}] ✅ Completion marker found after ${markerAttempt + 1} checks`);
          await abortableDelay(this.config.timing?.markerFoundStabilizationDelay || 1700, signal); // Stabilization delay
          const result = await this.#performScrape();
          if (result) return result;
          throw new Error("Polling found completion marker but scraping returned empty result");
        }
        
        await abortableDelay(this.config.timing?.markerCheckInterval || 200, signal); // Short interval for marker detection
      }
      console.log(`[Sidecar Harvest - ${platformKey}] ❌ No completion marker found after ${markerCheckAttempts} attempts`);
      throw new Error(`Polling failed: No completion marker found after ${markerCheckAttempts} attempts`);
    } else {
      console.log(`[Sidecar Harvest - ${platformKey}] ❌ No completion marker selector configured`);
      throw new Error("Polling failed: No completion marker selector configured for this provider");
    }
  }

  /**
   * The observer strategy: uses a MutationObserver to watch for a completion marker.
   * Driven by 'observeTarget', 'completionMarker', and 'timeout' from the config.
   */
  async #harvestWithObserver(signal = null) {
    const { platformKey, harvestStrategy, selectors } = this.config;
    console.log(`[Sidecar Harvest - ${platformKey}] Starting HARPA-inspired observer harvest with debounce fallback.`);
    const observeTargetSelector = selectors[harvestStrategy.observeTarget];
    const completionMarkerSelector = selectors.completionMarker;

    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new Error('Observer aborted'));
      if (!completionMarkerSelector) return reject(new Error("No 'completionMarker' selector in config for observer strategy."));

      let observer;
      let failsafeTimeout;
      let debounceTimer = null;
      const DEBOUNCE_DELAY = this.config.timing?.observerDebounceDelay || 1500; // 1.5 seconds of content stability

      const cleanup = () => {
        if (observer) observer.disconnect();
        if (failsafeTimeout) clearTimeout(failsafeTimeout);
        if (debounceTimer) clearTimeout(debounceTimer);
        if (signalListener) signal?.removeEventListener('abort', signalListener);
      };

      const finalScrape = async () => {
        if (!signal?.aborted) {
          const result = await this.#performScrape();
          resolve(result);
        }
      };

      const checkAndResolve = async () => {
        // Priority 1: Check for the definitive completion marker
        if (querySelector(completionMarkerSelector)) {
          console.log(`[Sidecar Harvest - ${platformKey}] ✅ Completion marker found.`);
          cleanup();
          setTimeout(finalScrape, 1700); // Stabilization delay
          return true;
        }
        return false;
      };

      const signalListener = signal ? () => { cleanup(); reject(new Error('Observer aborted')); } : null;
      if (signalListener) signal.addEventListener('abort', signalListener);
      
      const targetNode = querySelector(observeTargetSelector);
      if (!targetNode) return reject(new Error(`Observer failed: could not find node for target '${harvestStrategy.observeTarget}'`));

      observer = new MutationObserver(async () => {
        if (signal?.aborted) { cleanup(); return; }
        
        // Check for completion marker first
        if (await checkAndResolve()) return;

        // If no completion marker, use streaming-aware debounce fallback
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          // Check if still in thinking/generating state before triggering
          const streamingIndicatorSelector = selectors.streamingIndicator;
          if (streamingIndicatorSelector && querySelector(streamingIndicatorSelector)) {
            console.log(`[Sidecar Harvest - ${platformKey}] Still thinking/generating, resetting debounce timer...`);
            // Reset debounce timer - continue waiting
            debounceTimer = setTimeout(arguments.callee, DEBOUNCE_DELAY);
            return;
          }
          
          console.log(`[Sidecar Harvest - ${platformKey}] ✅ Content stable for ${DEBOUNCE_DELAY}ms + no streaming indicators (smart debounce).`);
          cleanup();
          await finalScrape();
        }, DEBOUNCE_DELAY);
      });

      observer.observe(targetNode, { childList: true, subtree: true });

      failsafeTimeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Observer timed out after ${harvestStrategy.timeout || 45000}ms`));
      }, harvestStrategy.timeout || 45000);
    });
  }

  /**
   * The final step: scraping the text content from the response element.
   * Uses the 'responseContainer' selectors from the config.
   * Now includes polling logic to wait for content to appear.
   */
  async #performScrape() {
    const { selectors, platformKey } = this.config;
    const responseSelector = selectors.responseContainer;
    if (!responseSelector) return null;

    let attempt = 0;
    const maxAttempts = this.config.timing?.scrapeMaxAttempts || 10;
    const delay = this.config.timing?.scrapeRetryDelay || 500;

    while(attempt < maxAttempts) {
      const responseElements = document.querySelectorAll(responseSelector.join(','));
      if (responseElements.length > 0) {
        const lastElement = responseElements[responseElements.length - 1];
        const text = lastElement?.textContent?.trim();
        if (text && text.length > 0) {
          console.log(`[Sidecar Scrape - ${platformKey}] ✅ Content found on attempt ${attempt + 1}.`);
          return text;
        }
      }
      attempt++;
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, delay));
      }
    }
    
    console.error(`[Sidecar Scrape - ${platformKey}] ❌ Scrape failed. Found container but it remained empty after ${maxAttempts} attempts.`);
    return null;
  }

  /**
   * Utility methods for result handling
   */
  #normalizeResult(rawResult, strategyName) {
    if (typeof rawResult === 'string' && rawResult.length > 0) {
      return {
        success: true,
        data: rawResult,
        meta: { strategy: strategyName }
      };
    }
    if (rawResult && typeof rawResult === 'object' && rawResult.success) {
      return { ...rawResult, meta: { ...rawResult.meta, strategy: strategyName } };
    }
    return this.#createErrorResult(`${strategyName} returned no usable result`, { strategy: strategyName });
  }

  #createErrorResult(message, meta = {}) {
    return {
      success: false,
      error: message,
      meta
    };
  }

  #enrichResult(result, additionalMeta) {
    return {
      ...result,
      meta: { ...result.meta, ...additionalMeta }
    };
  }

  #cancelRemainingControllers(controllers) {
    controllers.forEach(controller => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
      this.activeControllers.delete(controller);
    });
  }



  /**
   * Cleanup method for graceful shutdown
   */
  destroy() {
    // Cancel all active operations
    this.activeControllers.forEach(controller => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    });
    this.activeControllers.clear();
  }

  /**
   * Performs a specific readiness check using the dedicated `readyMarker`
   * and `loginMarker` selectors, following the specified logic.
   */
  async checkReadiness() {
    const { selectors, platformKey } = this.config;
    console.log(`[Sidecar Readiness - ${platformKey}] Checking for readiness markers.`);

    // Rule 1: Is the prompt textarea (or equivalent) present?
    const isReadyMarkerPresent = selectors.readyMarker && querySelector(selectors.readyMarker);

    if (isReadyMarkerPresent) {
      console.log(`[Sidecar Readiness - ${platformKey}] Found ready marker. Status: READY.`);
      return { success: true, status: 'READY', message: 'Provider is ready.' };
    }

    // Rule 2: If no ready marker, is the login button present?
    const isLoginMarkerPresent = selectors.loginMarker && querySelector(selectors.loginMarker);

    if (isLoginMarkerPresent) {
      console.log(`[Sidecar Readiness - ${platformKey}] Found login marker, but no ready marker. Status: LOGIN_REQUIRED.`);
      return { success: true, status: 'LOGIN_REQUIRED', message: 'User authentication is required.' };
    }
    
    // Rule 3: If neither marker is found, the state is unknown or the page has an error.
    const errorMessage = `Could not determine page state for ${platformKey}. Neither ready marker (e.g., prompt box) nor login marker (e.g., login button) was found. The page might be loading, showing an error, or has an unexpected layout.`;
    console.warn(`[Sidecar Readiness - ${platformKey}] ${errorMessage}`);
    return { 
      success: false, 
      status: 'SERVICE_ERROR',
      error: errorMessage,
    };
  }
}