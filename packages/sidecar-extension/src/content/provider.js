// provider.js - The True Hybrid Engine with Dual Harvest Methods

class Provider {
  constructor() {
    this.config = this._getConfigForCurrentHost();
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

  // Main harvest dispatcher.
  async harvest() {
    const { harvestStrategy, platformKey } = this.config;
    console.log(`[Sidecar Harvest - ${platformKey}] Dispatching with method: '${harvestStrategy.method}'`);
    if (!harvestStrategy || !harvestStrategy.method) {
      throw new Error("No harvestStrategy.method defined in config.");
    }
    switch (harvestStrategy.method) {
      case 'poll':
        return this.#harvestWithPolling();
      case 'observer':
        return this.#harvestWithObserver();
      default:
        throw new Error(`Unknown harvest method: ${harvestStrategy.method}`);
    }
  }

  // Helper for the "Adaptive Strategist" Polling Method.
  async #harvestWithPolling() {
    const { platformKey, harvestStrategy, selectors } = this.config;
    console.log(`[Sidecar Harvest - ${platformKey}] Starting polling harvest.`);
    let attempt = 0;
    while (attempt < harvestStrategy.maxAttempts) {
      let allChecksPassed = true;
      for (const check of harvestStrategy.completionChecks) {
          const list = selectors[check.target];
          if (check.type === 'absence' && this.#querySelector(list)) { allChecksPassed = false; break; }
          if (check.type === 'presence' && !this.#querySelector(list)) { allChecksPassed = false; break; }
      }
      if (allChecksPassed) {
          console.log(`[Sidecar Harvest - ${platformKey}] ✅ Polling checks passed.`);
          await new Promise(r => setTimeout(r, 250));
          const els = document.querySelectorAll(selectors.responseContainer.join(','));
          const text = els[els.length-1]?.textContent?.trim();
          if (text) return text;
          throw new Error("Found response container but empty.");
      }
      const delay = harvestStrategy.baseDelay * Math.pow(harvestStrategy.backoffMultiplier, attempt);
      await new Promise(r => setTimeout(r, delay));
      attempt++;
    }
    throw new Error(`Harvest failed after ${harvestStrategy.maxAttempts} polling attempts.`);
  }

  // Enhanced Observer Method - Waits for TRUE completion
  async #harvestWithObserver() {
    const { platformKey, harvestStrategy, selectors } = this.config;
    const observeTargetSelector = selectors[harvestStrategy.observeTarget];
    const responseSelector = selectors.responseContainer;
    const completionMarkerSelector = selectors.completionMarker;
    
    console.log(`[Sidecar Harvest - ${platformKey}] Starting observer harvest.`);
    
    const finalScrape = () => {
      const responseElements = document.querySelectorAll(responseSelector.join(','));
      if (responseElements.length > 0) {
        return responseElements[responseElements.length - 1]?.textContent?.trim();
      }
      return null;
    };

    const isResponseComplete = () => {
      // Method 1: Check for completion marker (copy button, etc.)
      if (completionMarkerSelector && this.#querySelector(completionMarkerSelector)) {
        return true;
      }
      
      // Method 2: Check for streaming indicator absence (if configured)
      if (selectors.streamingIndicator && !this.#querySelector(selectors.streamingIndicator)) {
        // Only consider complete if we also have content
        const content = finalScrape();
        return content && content.length > 10;
      }
      
      return false;
    };

    return new Promise((resolve, reject) => {
      // STEP 1: Check if already complete
      if (isResponseComplete()) {
        const content = finalScrape();
        if (content) {
          console.log(`[Sidecar Harvest - ${platformKey}] ✅ Response already complete on initial check.`);
          return resolve(content);
        }
      }

      // STEP 2: Set up observer with completion detection
      const targetNode = this.#querySelector(observeTargetSelector);
      if (!targetNode) {
        return reject(new Error(`Observer failed: could not find node for target '${harvestStrategy.observeTarget}'`));
      }

      let lastContent = '';
      let stabilityTimer = null;
      const STABILITY_DELAY = 2000; // Wait 2s after content stops changing
      let contentChecks = 0;
      const MAX_CONTENT_CHECKS = 3; // Require 3 stable checks

      const observer = new MutationObserver(() => {
        // Check completion markers first (highest priority)
        if (isResponseComplete()) {
          clearTimeout(stabilityTimer);
          observer.disconnect();
          const content = finalScrape();
          console.log(`[Sidecar Harvest - ${platformKey}] ✅ Completion marker detected.`);
          return resolve(content || 'Response completed but content not found');
        }

        // Fallback: Content stability detection
        const currentContent = finalScrape();
        if (currentContent && currentContent.length > 20) { // Minimum viable content
          if (currentContent === lastContent) {
            contentChecks++;
            if (contentChecks >= MAX_CONTENT_CHECKS) {
              clearTimeout(stabilityTimer);
              observer.disconnect();
              console.log(`[Sidecar Harvest - ${platformKey}] ✅ Content stable after ${MAX_CONTENT_CHECKS} checks.`);
              return resolve(currentContent);
            }
          } else {
            // Content changed, reset stability tracking
            lastContent = currentContent;
            contentChecks = 0;
            clearTimeout(stabilityTimer);
            
            // Set new stability timer
            stabilityTimer = setTimeout(() => {
              observer.disconnect();
              console.log(`[Sidecar Harvest - ${platformKey}] ✅ Content stable for ${STABILITY_DELAY}ms - assuming complete.`);
              resolve(currentContent);
            }, STABILITY_DELAY);
          }
        }
      });

      observer.observe(targetNode, { 
        childList: true, 
        subtree: true, 
        characterData: true 
      });

      // Failsafe timeout
      setTimeout(() => {
        clearTimeout(stabilityTimer);
        observer.disconnect();
        const lastTryContent = finalScrape();
        if (lastTryContent && lastTryContent.length > 20) {
          console.log(`[Sidecar Harvest - ${platformKey}] ⚠️ Timeout reached, returning available content.`);
          resolve(lastTryContent);
        } else {
          reject(new Error(`Observer timed out after ${harvestStrategy.timeout}ms with insufficient content.`));
        }
      }, harvestStrategy.timeout);
    });
  }
}

// Instantiate and export the singleton provider.
let providerInstance;
try {
  providerInstance = new Provider();
} catch (e) {
  console.error('[Sidecar] Provider initialization failed:', e);
  providerInstance = null;
}
export { providerInstance as provider };