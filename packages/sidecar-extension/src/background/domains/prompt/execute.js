import { 
    BROADCAST_PROMPT, 
    STREAM_DONE, 
    NETWORK_RESPONSE_DETECTED, 
    DOM_CHANGE_DETECTED,
    HARVEST_COMPLETE,
    HARVEST_RESULT
} from '@hybrid-thinking/messaging';
import { flightManager } from '../../utils/flightManager.js';
import { configManager } from '../../utils/configManager.js';

/**
 * Orchestrates the headless prompt execution workflow using FlightManager.
 * @param {object} payload - The message payload.
 * @param {string} payload.providerKey - The provider key (e.g., 'chatgpt', 'claude').
 * @param {string} payload.prompt - The prompt text to execute.
 * @param {string} [payload.sessionId] - An optional session ID.
 * @param {object} [payload.options] - Execution options (timeout, retries, etc.).
 * @returns {Promise<string>} A promise that resolves with the harvested response or rejects with an error.
 */
export default async function execute({ providerKey, prompt, sessionId, options = {} }) {
    const config = await configManager.getConfig(providerKey);
    const executionStrategy = config?.executionStrategy || {};
    console.log(`[Execute] Starting prompt execution for provider: ${providerKey}`);
    
    try {
        // Launch a new flight
        const flight = await flightManager.launchFlight(providerKey, prompt, {
            timeout: options.timeout || executionStrategy.flightTimeout || 30000,
            maxRetries: options.maxRetries || 2,
            metadata: { sessionId, ...options.metadata }
        });
        
        console.log(`[Execute] Flight ${flight.flightId} launched on tab ${flight.tabId}`);
        
        // Phase 3: Promise.race orchestration with three contenders
        const resultPromise = new Promise((resolve, reject) => {
            let isResolved = false;
            const cleanup = () => {
                if (networkListener) chrome.runtime.onMessage.removeListener(networkListener);
                if (domListener) chrome.runtime.onMessage.removeListener(domListener);
                if (streamListener) chrome.runtime.onMessage.removeListener(streamListener);
                if (timeoutId) clearTimeout(timeoutId);
            };
            
            const resolveOnce = (result, source) => {
                if (isResolved) return;
                isResolved = true;
                console.log(`[Execute] Flight ${flight.flightId} resolved via ${source}`);
                cleanup();
                flightManager.completeFlight(flight.flightId, result);
                resolve(result);
            };
            
            const rejectOnce = (error, source) => {
                if (isResolved) return;
                isResolved = true;
                console.log(`[Execute] Flight ${flight.flightId} failed via ${source}:`, error);
                cleanup();
                flightManager.failFlight(flight.flightId, error);
                reject(error);
            };
            
            // 1. Network Promise - detects streaming API responses
            let networkListener = null;
            const networkPromise = new Promise((networkResolve) => {
                networkListener = (message, sender) => {
                    if (sender.tab?.id === flight.tabId && 
                        message.type === NETWORK_RESPONSE_DETECTED &&
                        message.payload?.flightId === flight.flightId) {
                        
                        console.log(`[Execute] Network response detected for flight ${flight.flightId}`);
                        // Give a small delay for the response to complete
                        setTimeout(async () => {
                            try {
                                // Trigger harvest after network detection
                                const harvestResult = await triggerHarvest(flight.tabId, flight.flightId, sessionId);
                                networkResolve(harvestResult);
                            } catch (error) {
                                console.warn('[Execute] Network-triggered harvest failed:', error);
                            }
                        }, executionStrategy.networkResponseDelay || 1000);
                    }
                };
                chrome.runtime.onMessage.addListener(networkListener);
            });
            
            // 2. DOM Promise - detects significant DOM changes
            let domListener = null;
            const domPromise = new Promise((domResolve) => {
                domListener = (message, sender) => {
                    if (sender.tab?.id === flight.tabId && 
                        message.type === DOM_CHANGE_DETECTED &&
                        message.payload?.flightId === flight.flightId) {
                        
                        console.log(`[Execute] DOM change detected for flight ${flight.flightId}`);
                        // Give a longer delay for DOM-based detection
                        setTimeout(async () => {
                            try {
                                const harvestResult = await triggerHarvest(flight.tabId, flight.flightId, sessionId);
                                domResolve(harvestResult);
                            } catch (error) {
                                console.warn('[Execute] DOM-triggered harvest failed:', error);
                            }
                        }, executionStrategy.domChangeDelay || 2000);
                    }
                };
                chrome.runtime.onMessage.addListener(domListener);
            });
            
            // 3. Traditional Stream Done Promise (fallback)
            let streamListener = null;
            const streamPromise = new Promise((streamResolve) => {
                streamListener = (message, sender) => {
                    if (sender.tab?.id === flight.tabId && message.type === STREAM_DONE) {
                        console.log(`[Execute] Traditional stream done for flight ${flight.flightId}`);
                        streamResolve(message.payload);
                    }
                };
                chrome.runtime.onMessage.addListener(streamListener);
            });
            
            // 4. Timeout Promise
            let timeoutId = null;
            const timeoutPromise = new Promise((_, timeoutReject) => {
                timeoutId = setTimeout(() => {
                    timeoutReject(new Error(`Execution timeout after ${flight.metadata.timeout}ms`));
                }, flight.metadata.timeout);
            });
            
            // Send the prompt to the worker tab
            chrome.tabs.sendMessage(flight.tabId, {
                type: BROADCAST_PROMPT,
                payload: { prompt, sessionId, flightId: flight.flightId }
            }).catch(error => {
                rejectOnce(error, 'broadcast');
            });
            
            // Race all promises
            Promise.race([
                networkPromise.then(result => resolveOnce(result, 'network')),
                domPromise.then(result => resolveOnce(result, 'dom')),
                streamPromise.then(result => resolveOnce(result, 'stream')),
                timeoutPromise.catch(error => rejectOnce(error, 'timeout'))
            ]).catch(error => {
                rejectOnce(error, 'race');
            });
        });
        
        // Helper function to trigger harvest
        async function triggerHarvest(tabId, flightId, sessionId) {
            return new Promise((resolve, reject) => {
                const harvestTimeout = setTimeout(() => {
                    chrome.runtime.onMessage.removeListener(harvestListener);
                    reject(new Error('Harvest timeout'));
                }, executionStrategy.harvestTimeout || 10000);
                
                const harvestListener = (message, sender) => {
                    if (sender.tab?.id === tabId && 
                        message.type === HARVEST_COMPLETE &&
                        message.payload?.flightId === flightId) {
                        
                        clearTimeout(harvestTimeout);
                        chrome.runtime.onMessage.removeListener(harvestListener);
                        
                        if (message.payload.success !== false) {
                            resolve(message.payload.result);
                        } else {
                            reject(new Error(message.payload.error || 'Harvest failed'));
                        }
                    }
                };
                
                chrome.runtime.onMessage.addListener(harvestListener);
                
                // Send harvest request
                chrome.tabs.sendMessage(tabId, {
                    type: HARVEST_RESULT,
                    payload: { sessionId, flightId }
                }).catch(reject);
            });
        }
        
        const result = await resultPromise;
        console.log(`[Execute] Flight ${flight.flightId} completed successfully`);
        
        return result;
        
    } catch (error) {
        console.error(`[Execute] Error during execution for ${providerKey}:`, error);
        throw error;
    }
}