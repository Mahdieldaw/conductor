import chatgptConfig from './configs/chatgpt.json'; 
import claudeConfig from './configs/claude.json'; 

const configs = [chatgptConfig, claudeConfig]; 

export class Provider { 
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
        let inputElement = null; 

        // Loop through all selectors in the config until one is found. This is our universal identifier logic. 
        for (const selector of this.config.inputSelectors) { 
            try { 
                inputElement = await this.#waitForElement(selector, 2000); 
                if (inputElement) { 
                    console.log(`[Sidecar] Found input element using selector: "${selector}"`); 
                    break; 
                } 
            } catch (error) { 
                console.log(`[Sidecar] Selector "${selector}" not found, trying next...`); 
            } 
        } 

        if (!inputElement) { 
            throw new Error(`Could not find a valid input element for ${this.config.platformKey}.`); 
        } 

        inputElement.focus(); 
        
        // This handles both regular textareas and complex content-editable divs. 
        if (inputElement.isContentEditable) { 
            inputElement.textContent = prompt; 
        } else { 
            inputElement.value = prompt; 
        } 
        inputElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true })); 

        // Patiently wait for the send button to become enabled. 
        await new Promise(r => setTimeout(r, 500)); 
    
        try { 
            await this.#waitForCondition(() => { 
                const button = document.querySelector(this.config.sendButtonSelector); 
                return button && !button.disabled; 
            }, 3000); 

            const sendButton = document.querySelector(this.config.sendButtonSelector); 
            sendButton.click(); 
            console.log(`[Sidecar] Successfully submitted via button click for ${this.config.platformKey}.`); 

        } catch (error) { 
            console.warn(`[Sidecar] Button was not enabled in time. Falling back to Enter key press for ${this.config.platformKey}.`); 
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }); 
            inputElement.dispatchEvent(enterEvent); 
        } 
    } 

    async harvest() { 
        return new Promise((resolve, reject) => { 
            const timeout = 90000; 
            const startTime = Date.now(); 

            // Stage 1: The Polling Loop. Patiently waits for the stream to finish. 
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

            // Stage 2: The Final Scrape. Runs once after streaming stops. 
            const finalizeHarvest = async () => { 
                try { 
                    await new Promise(r => setTimeout(r, 500)); // Grace period for final UI render. 

                    const responseContainers = document.querySelectorAll(this.config.responseContainerSelector); 
                    if (responseContainers.length > 0) { 
                        const lastResponse = responseContainers[responseContainers.length - 1]; 
                        const responseText = lastResponse.textContent.trim(); 
                        
                        if (responseText.length > 0) { 
                            resolve(responseText); 
                        } else { 
                            reject(new Error("Harvest failed: Response container was found but remained empty.")); 
                        } 
                    } else { 
                        reject(new Error("Harvest failed: Response container selector found no elements on the page.")); 
                    }
                } catch (e) {
                    reject(new Error(`Error during final harvest for ${this.config.platformKey}: ${e.message}`));
                }
            };
        });
    }
}