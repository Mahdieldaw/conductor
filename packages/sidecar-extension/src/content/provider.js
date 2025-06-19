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
  
  // Handles an ARRAY of selectors.
  #querySelector(selectorArray) {
    if (!selectorArray || !Array.isArray(selectorArray)) return null;
    for (const selector of selectorArray) {
      try {
        const element = document.querySelector(selector);
        if (element) return element;
      } catch (e) {
        console.warn(`[Sidecar] Invalid selector in array: ${selector}`, e);
      }
    }
    return null;
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

  // Unified broadcast method.
  async broadcast(prompt) {
    const { platformKey, broadcastStrategy, selectors } = this.config;
    for (const step of broadcastStrategy) {
        const { action, target, value } = step;
        const cssSelectorList = target ? selectors[target] : null;
        try {
            switch (action) {
                case 'fill': {
                    const el = await this.#waitForElement(cssSelectorList);
                    this.#setElementText(el, value.replace('{{prompt}}', prompt));
                    break;
                }
                case 'click': {
                    const el = this.#querySelector(cssSelectorList);
                    if (el && !el.disabled) {
                        el.click();
                    } else {
                        throw new Error(`Broadcast failed: Click target '${target}' not found or was disabled.`);
                    }
                    break;
                }
                case 'wait':
                    await new Promise(r => setTimeout(r, step.ms));
                    break;
            }
        } catch (error) {
            console.error(`[Sidecar Broadcast - ${platformKey}] Error during action '${action}'`, error);
            throw error;
        }
    }
  }

  /**
   * Main harvest dispatcher with concurrent execution support
   * Returns normalized { success: boolean, data?: string, error?: string, meta?: object }
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
   * Concurrent harvest execution - both methods race, winner takes all
   */
  async #executeConcurrentHarvest() {
    const { platformKey } = this.config;
    console.log(`[Sidecar Harvest - ${platformKey}] Starting concurrent harvest (polling vs observer)`);
    // Create abort controllers for both strategies
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
      // Race the strategies - first successful result wins
      const result = await Promise.race([pollingPromise, observerPromise]);
      // Cancel the losing strategy
      this.#cancelRemainingControllers([pollingController, observerController]);
      console.log(`[Sidecar Harvest - ${platformKey}] ✅ Concurrent harvest completed, winner: ${result.meta?.strategy}`);
      return result;
    } catch (error) {
      // If race fails, cancel everything and return error
      this.#cancelRemainingControllers([pollingController, observerController]);
      throw error;
    }
  }

  /**
   * Execute a single strategy with error handling and normalization
   */
  async #executeStrategy(strategyName, executor, controller = null) {
    const { platformKey } = this.config;
    try {
      const rawResult = await executor();
      // Check if operation was aborted
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
   * Enhanced polling method with abort signal support
   */
  async #harvestWithPolling(signal = null) {
    const { platformKey, harvestStrategy, selectors } = this.config;
    console.log(`[Sidecar Harvest - ${platformKey}] Starting polling harvest.`);
    let attempt = 0;
    const maxAttempts = harvestStrategy.maxAttempts || 10;
    while (attempt < maxAttempts) {
      // Check for abort signal
      if (signal?.aborted) {
        throw new Error('Polling aborted');
      }
      let allChecksPassed = true;
      for (const check of harvestStrategy.completionChecks || []) {
        const list = selectors[check.target];
        if (check.type === 'absence' && this.#querySelector(list)) { 
          allChecksPassed = false; 
          break; 
        }
        if (check.type === 'presence' && !this.#querySelector(list)) { 
          allChecksPassed = false; 
          break; 
        }
      }
      if (allChecksPassed) {
        console.log(`[Sidecar Harvest - ${platformKey}] ✅ Polling checks passed on attempt ${attempt + 1}`);
        // Stabilization delay
        await this.#abortableDelay(2000, signal);
        const result = this.#performScrape();
        if (result) return result;
        throw new Error("Polling detected completion but scraping returned empty result");
      }
      const delay = (harvestStrategy.baseDelay || 500) * Math.pow(harvestStrategy.backoffMultiplier || 1.2, attempt);
      await this.#abortableDelay(delay, signal);
      attempt++;
    }
    throw new Error(`Polling failed after ${maxAttempts} attempts`);
  }

  /**
   * Enhanced observer method with abort signal support
   */
  async #harvestWithObserver(signal = null) {
    const { platformKey, harvestStrategy, selectors } = this.config;
    console.log(`[Sidecar Harvest - ${platformKey}] Starting intelligent observer harvest.`);
    const observeTargetSelector = selectors[harvestStrategy.observeTarget];
    const completionMarkerSelector = selectors.completionMarker;
    return new Promise((resolve, reject) => {
      // Check for abort signal
      if (signal?.aborted) {
        return reject(new Error('Observer aborted'));
      }
      let observer;
      let failsafeTimeout;
      // Cleanup logic
      const cleanup = () => {
        if (observer) observer.disconnect();
        if (failsafeTimeout) clearTimeout(failsafeTimeout);
        if (signalListener) signal?.removeEventListener('abort', signalListener);
      };
      // Abort signal listener
      const signalListener = signal ? () => {
        cleanup();
        reject(new Error('Observer aborted'));
      } : null;
      if (signalListener) {
        signal.addEventListener('abort', signalListener);
      }
      // Helper to check for completion marker
      const checkForCompletion = () => {
        return this.#querySelector(completionMarkerSelector);
      };
      // STEP 1: Immediate check
      if (checkForCompletion()) {
        console.log(`[Sidecar Harvest - ${platformKey}] ✅ Completion marker found on initial check.`);
        cleanup();
        return resolve(this.#performScrape());
      }
      // STEP 2: Set up observer
      const targetNode = this.#querySelector(observeTargetSelector);
      if (!targetNode) {
        cleanup();
        return reject(new Error(`Observer failed: could not find node for target '${harvestStrategy.observeTarget}'`));
      }
      try {
        observer = new MutationObserver(() => {
          if (signal?.aborted) {
            cleanup();
            return reject(new Error('Observer aborted'));
          }
          if (checkForCompletion()) {
            console.log(`[Sidecar Harvest - ${platformKey}] ✅ Completion marker detected by observer.`);
            cleanup();
            // Stabilization delay before scraping
            setTimeout(() => {
              if (!signal?.aborted) {
                resolve(this.#performScrape());
              }
            }, 2000); // Changed to 2 seconds
          }
        });
        observer.observe(targetNode, { 
          childList: true, 
          subtree: true,
          attributes: true,
          attributeFilter: ['data-is-streaming', 'class']
        });
      } catch (error) {
        cleanup();
        return reject(new Error(`Failed to create observer: ${error.message}`));
      }
      // STEP 3: Failsafe timeout
      failsafeTimeout = setTimeout(() => {
        console.warn(`[Sidecar Harvest - ${platformKey}] ⚠️ Observer timed out after ${harvestStrategy.timeout}ms`);
        cleanup();
        // Final attempt at scraping
        const result = this.#performScrape();
        if (result) {
          resolve(result);
        } else {
          reject(new Error(`Observer timed out and no content found`));
        }
      }, harvestStrategy.timeout || 45000);
    });
  }

  /**
   * Centralized scraping logic with enhanced element detection
   */
  #performScrape() {
    const { selectors } = this.config;
    const responseSelector = selectors.responseContainer;
    if (!responseSelector || !Array.isArray(responseSelector)) {
      throw new Error('Invalid responseContainer selector configuration');
    }
    const responseElements = document.querySelectorAll(responseSelector.join(','));
    if (responseElements.length === 0) {
      return null;
    }
    // Get the last response element
    const lastElement = responseElements[responseElements.length - 1];
    // Multiple extraction attempts
    const extractionStrategies = [
      () => lastElement.textContent?.trim(),
      () => lastElement.innerText?.trim(),
      () => lastElement.querySelector('.markdown, .prose, [class*="message"]')?.textContent?.trim(),
      () => Array.from(lastElement.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent?.trim())
        .filter(Boolean)
        .join(' ')
    ];
    for (const strategy of extractionStrategies) {
      try {
        const result = strategy();
        if (result && result.length > 0) {
          return result;
        }
      } catch (error) {
        console.warn('[Sidecar] Text extraction strategy failed:', error);
      }
    }
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