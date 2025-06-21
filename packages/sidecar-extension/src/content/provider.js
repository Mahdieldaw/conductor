// provider.js - Production-Grade Concurrent Harvest Engine

class Provider {
  constructor() {
    this.config = this._getConfigForCurrentHost();
    this.activeControllers = new Set(); // Track active abort controllers
  }

  // Correctly handles default exports from JSON modules.
  _getConfigForCurrentHost() {
    const modules = import.meta.glob('./configs/*.json', { eager: true });
    const configs = Object.values(modules).map(m => m.default ?? m);

    const hostname = window.location.hostname;
    const config = configs.find(c => c.hostnames.some(h => hostname.includes(h)));
    if (!config) throw new Error(`No provider configuration for hostname: ${hostname}`);
    return config;
  }
  
  // Handles an ARRAY of selectors, including searching within Shadow DOMs.
  #querySelector(selectorArray) {
    if (!selectorArray || !Array.isArray(selectorArray)) return null;

    const findElement = (selectors, root) => {
      for (const selector of selectors) {
        try {
          // Check the current root
          const element = root.querySelector(selector);
          if (element) return element;
        } catch (e) {
          // This can happen with invalid selectors, especially during development
          console.warn(`[Sidecar] Invalid selector in array: ${selector}`, e);
          continue; // Try the next selector
        }
      }

      // If not found, search inside all shadow roots in the current root
      const shadowRoots = root.querySelectorAll('*');
      for (const element of shadowRoots) {
        if (element.shadowRoot) {
          const foundInShadow = findElement(selectors, element.shadowRoot);
          if (foundInShadow) return foundInShadow;
        }
      }

      return null;
    };

    return findElement(selectorArray, document);
  }

  // Waits for an element to appear.
  async #waitForElement(selectorArray, timeout = 7000) {
    return new Promise((resolve, reject) => {
        let el = this.#querySelector(selectorArray);
        if (el) return resolve(el);
        const observer = new MutationObserver(() => {
            el = this.#querySelector(selectorArray);
            if (el) {
                observer.disconnect();
                resolve(el);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Element not found after ${timeout}ms for selectors: ${selectorArray.join(' OR ')}`));
        }, timeout);
    });
  }

  // Unified helper for setting text.
  #setElementText(el, text) {
    if (!el) throw new Error('Cannot set text on a null element.');
    el.focus();
    if (typeof el.value !== 'undefined') {
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    } else if (el.isContentEditable) {
        el.textContent = text;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
    } else {
        throw new Error("Target element is not a standard input or contentEditable.");
    }
  }

  // Unified broadcast method with normalized response structure and metadata
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
            const el = await this.#waitForElement(cssSelectorList, timeout || 7000);
            this.#setElementText(el, value.replace('{{prompt}}', prompt));
            break;
          }

          case 'click': {
            if (!cssSelectorList) throw new Error(`No selectors defined for target: ${target}`);
            // Use the timeout from the JSON config.
            const el = await this.#waitForElement(cssSelectorList, timeout || 5000);
            if (el.disabled) {
              // This is a specific failure case after the element is found.
              throw new Error(`Element for target '${target}' was found but is disabled.`);
            }
            el.click();
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
   */
  async harvest() {
    const { harvestStrategy, platformKey } = this.config;
    console.log(`[Sidecar Harvest - ${platformKey}] Dispatching with method: '${harvestStrategy.method}'`);
    if (!harvestStrategy?.method) {
      return this.#createErrorResult('No harvestStrategy.method defined in config.');
    }
    const startTime = performance.now();
    try {
      let result;
      switch (harvestStrategy.method) {
        case 'poll':
          result = await this.#executeStrategy('polling', () => this.#harvestWithPolling());
          break;
        case 'observer':
          result = await this.#executeStrategy('observer', () => this.#harvestWithObserver());
          break;
        case 'concurrent':
        case 'race':
          result = await this.#executeConcurrentHarvest();
          break;
        default:
          return this.#createErrorResult(`Unknown harvest method: ${harvestStrategy.method}`);
      }
      const duration = performance.now() - startTime;
      return this.#enrichResult(result, { duration, method: harvestStrategy.method });
    } catch (error) {
      const duration = performance.now() - startTime;
      return this.#createErrorResult(error.message || String(error), { duration, method: harvestStrategy.method });
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
    let attempt = 0;
    const maxAttempts = harvestStrategy.maxAttempts || 10;

    while (attempt < maxAttempts) {
      if (signal?.aborted) throw new Error('Polling aborted');

      // Uses 'completionChecks' from config if available, otherwise defaults to checking for absence of streaming indicator.
      const checks = harvestStrategy.completionChecks || [{ type: 'absence', target: 'streamingIndicator' }];
      let allChecksPassed = true;
      for (const check of checks) {
        const list = selectors[check.target];
        if (!list) continue; // Skip if selector for check is not defined
        if (check.type === 'absence' && this.#querySelector(list)) { 
          allChecksPassed = false; break; 
        }
        if (check.type === 'presence' && !this.#querySelector(list)) { 
          allChecksPassed = false; break; 
        }
      }

      if (allChecksPassed) {
        console.log(`[Sidecar Harvest - ${platformKey}] ✅ Polling checks passed on attempt ${attempt + 1}`);
        await this.#abortableDelay(500, signal); // Stabilization delay
        const result = this.#performScrape();
        if (result) return result;
        throw new Error("Polling detected completion but scraping returned empty result");
      }
      
      const delay = (harvestStrategy.baseDelay || 500) * Math.pow(harvestStrategy.backoffMultiplier || 1.2, attempt);
      await this.#abortableDelay(delay, signal);
      attempt++;
    }
    throw new Error(`Polling failed after ${maxAttempts} attempts.`);
  }

  /**
   * The observer strategy: uses a MutationObserver to watch for a completion marker.
   * Driven by 'observeTarget', 'completionMarker', and 'timeout' from the config.
   */
  async #harvestWithObserver(signal = null) {
    const { platformKey, harvestStrategy, selectors } = this.config;
    console.log(`[Sidecar Harvest - ${platformKey}] Starting intelligent observer harvest.`);
    const observeTargetSelector = selectors[harvestStrategy.observeTarget];
    const completionMarkerSelector = selectors.completionMarker;

    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new Error('Observer aborted'));
      if (!completionMarkerSelector) return reject(new Error("No 'completionMarker' selector in config for observer strategy."));

      let observer;
      let failsafeTimeout;

      const cleanup = () => {
        if (observer) observer.disconnect();
        if (failsafeTimeout) clearTimeout(failsafeTimeout);
        if (signalListener) signal?.removeEventListener('abort', signalListener);
      };

      const signalListener = signal ? () => { cleanup(); reject(new Error('Observer aborted')); } : null;
      if (signalListener) signal.addEventListener('abort', signalListener);
      
      const targetNode = this.#querySelector(observeTargetSelector);
      if (!targetNode) return reject(new Error(`Observer failed: could not find node for target '${harvestStrategy.observeTarget}'`));

      observer = new MutationObserver(() => {
        if (signal?.aborted) { cleanup(); return; }
        if (this.#querySelector(completionMarkerSelector)) {
          console.log(`[Sidecar Harvest - ${platformKey}] ✅ Completion marker detected by observer.`);
          cleanup();
          setTimeout(() => !signal?.aborted && resolve(this.#performScrape()), 200); // Stabilization delay
        }
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
   */
  #performScrape() {
    const { selectors } = this.config;
    const responseSelector = selectors.responseContainer;
    if (!responseSelector || !Array.isArray(responseSelector)) return null;

    const responseElements = document.querySelectorAll(responseSelector.join(','));
    if (responseElements.length === 0) return null;

    const lastElement = responseElements[responseElements.length - 1];
    return lastElement?.textContent?.trim() || null;
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

  #abortableDelay(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        return reject(new Error('Delay aborted'));
      }
      const timeout = setTimeout(() => {
        signalListener && signal?.removeEventListener('abort', signalListener);
        resolve();
      }, ms);
      const signalListener = signal ? () => {
        clearTimeout(timeout);
        reject(new Error('Delay aborted'));
      } : null;
      if (signalListener) {
        signal.addEventListener('abort', signalListener);
      }
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
}

// Instantiate and export the singleton provider
let providerInstance;
try {
  providerInstance = new Provider();
} catch (e) {
  console.error('[Sidecar] Provider initialization failed:', e);
  providerInstance = null;
}

export { providerInstance as provider };