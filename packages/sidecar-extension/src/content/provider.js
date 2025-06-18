import chatgptConfig from './configs/chatgpt.json'; 
import claudeConfig from './configs/claude.json'; 

const configs = [chatgptConfig, claudeConfig]; 

class Provider { // Note: class is no longer exported directly, it's internal to this module.
    constructor() { 
        this.config = this._getConfigForCurrentHost(); 
    } 

    _getConfigForCurrentHost() { 
        const hostname = window.location.hostname; 
        const config = configs.find(c => c.hostnames.some(h => hostname.includes(h))); 
        if (!config) { 
            throw new Error(`No provider configuration found for hostname: ${hostname}`); 
        } 
        return config; 
    } 

    async #waitForElement(selector, timeout = 7000) { 
        return new Promise((resolve, reject) => { 
            const el = document.querySelector(selector); 
            if (el) return resolve(el); 

            const observer = new MutationObserver(() => { 
                const el = document.querySelector(selector); 
                if (el) { 
                    observer.disconnect(); 
                    resolve(el); 
                } 
            }); 
            observer.observe(document.body, { childList: true, subtree: true }); 

            setTimeout(() => { 
                observer.disconnect(); 
                reject(new Error(`Element with selector "${selector}" not found after ${timeout}ms`)); 
            }, timeout); 
        }); 
    } 

    async #waitForCondition(conditionFn, timeout = 3000, interval = 200) { 
        return new Promise((resolve, reject) => { 
            const startTime = Date.now(); 
            const check = () => { 
                if (conditionFn()) { 
                    resolve(true); 
                } else if (Date.now() - startTime > timeout) { 
                    reject(new Error(`Condition not met within ${timeout}ms`)); 
                } else { 
                    setTimeout(check, interval); 
                } 
            }; 
            check(); 
        }); 
    } 

    async broadcast(prompt) {
        const { platformKey, broadcastStrategy } = this.config;
        if (!broadcastStrategy || !Array.isArray(broadcastStrategy)) {
            throw new Error(`No valid broadcastStrategy found for ${platformKey}.`);
        }

        console.log(`[Sidecar Broadcast - ${platformKey}] Executing ${broadcastStrategy.length}-step strategy.`);

        for (const step of broadcastStrategy) {
            const { action, selector, value, key, ms } = step;
            console.log(`[Sidecar Broadcast - ${platformKey}] Running action: ${action}`);

            try {
                switch (action) {
                    case 'type': {
                        const el = await this.#waitForElement(selector);
                        const text = value.replace('{{prompt}}', prompt);
                        el.focus();
                        if (el.isContentEditable) {
                            el.textContent = text;
                        } else {
                            el.value = text;
                        }
                        el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                        break;
                    }
                    case 'click': {
                        const el = document.querySelector(selector);
                        if (el && !el.disabled) {
                            el.click();
                        } else {
                            console.warn(`[Sidecar Broadcast - ${platformKey}] Click target not found or disabled: ${selector}`);
                        }
                        break;
                    }
                    case 'keydown': {
                        const el = await this.#waitForElement(selector);
                        el.dispatchEvent(new KeyboardEvent('keydown', {
                            key: key,
                            code: key, // e.g., 'Enter'
                            bubbles: true,
                            cancelable: true,
                        }));
                        break;
                    }
                    case 'wait': {
                        await new Promise(r => setTimeout(r, ms));
                        break;
                    }
                    default:
                        console.warn(`[Sidecar Broadcast - ${platformKey}] Unknown action: ${action}`);
                }
            } catch (error) {
                console.error(`[Sidecar Broadcast - ${platformKey}] Error during action "${action}" with selector "${selector}":`, error);
                // In a more advanced version, you could have logic to stop or continue on error.
                throw error; 
            }
        }
        console.log(`[Sidecar Broadcast - ${platformKey}] Strategy execution complete.`);
    } 

    async harvest() { 
        return new Promise((resolve, reject) => { 
            const timeout = 90000; 
            const startTime = Date.now(); 

            const poller = setInterval(() => { 
                if (Date.now() - startTime > timeout) { 
                    clearInterval(poller); 
                    return reject(new Error(`Timeout: Stream did not complete for ${this.config.platformKey}.`)); 
                } 
                const isStreaming = !!document.querySelector(this.config.streamingIndicatorSelector); 
                if (!isStreaming) { 
                    clearInterval(poller); 
                    finalizeHarvest(); 
                } 
            }, 750); 

            const finalizeHarvest = async () => { 
                try { 
                    await new Promise(r => setTimeout(r, 500)); // Grace period for final UI render. 

                    const platformKey = this.config.platformKey;
                    console.log(`[Sidecar Harvest - ${platformKey}] Searching for selector: "${this.config.responseContainerSelector}"`);
                    const responseContainers = document.querySelectorAll(this.config.responseContainerSelector); 
                    console.log(`[Sidecar Harvest - ${platformKey}] Found ${responseContainers.length} matching containers.`);

                    if (responseContainers.length > 0) { 
                        const lastResponse = responseContainers[responseContainers.length - 1]; 
                        console.log(`[Sidecar Harvest - ${platformKey}] Last container found. outerHTML:`, lastResponse.outerHTML);
                        
                        const responseText = lastResponse.textContent?.trim(); 
                        console.log(`[Sidecar Harvest - ${platformKey}] Extracted textContent (length: ${responseText?.length}):`, responseText);
                        
                        if (responseText && responseText.length > 0) { 
                            resolve(responseText); 
                        } else { 
                            reject(new Error("Harvest failed: Response container was found but its textContent is empty.")); 
                        } 
                    } else { 
                        reject(new Error("Harvest failed: Response container selector found no elements on the page.")); 
                    }
                } catch (e) {
                    const platformKey = this.config.platformKey;
                    reject(new Error(`Error during final harvest for ${platformKey}: ${e.message}`));
                }
            };
        });
    }
}


// --- THE FIX IS HERE ---
let providerInstance;
try {
  // Create an instance of the class *within this module*.
  providerInstance = new Provider();
} catch (e) {
  // This is expected. It just means we are on a webpage that is not a configured LLM provider.
  // The instance will remain `undefined`, and content.js will handle this.
  providerInstance = null;
}

// Export the created INSTANCE as the named export 'provider'.
export { providerInstance as provider };