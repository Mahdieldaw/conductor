// This script is injected into the main world and is responsible for
// Configuration-driven inpage script for Unified Sidecar v2.0
// Handles prompt broadcasting and result harvesting using provider configurations
// Phase 3: Enhanced with hybrid harvesting orchestration

console.log('[Sidecar InPage] Boot script loaded');

// Import message types from shared-messaging
import {
    BROADCAST_PROMPT,
    HARVEST_RESULT,
    PROVIDER_READY,
    PROVIDER_ERROR,
    NETWORK_RESPONSE_DETECTED,
    DOM_CHANGE_DETECTED,
    BROADCAST_COMPLETE,
    HARVEST_COMPLETE,
    GET_PROVIDER_CONFIG
} from '@hybrid-thinking/messaging';

(function() {

    // Network monitoring state
    let networkMonitoringActive = false;
    let domObserverActive = false;
    let currentFlightId = null;
    let responseDetectionCallbacks = new Map();

    let currentProvider = null;
    let isInitialized = false;

    // Network monitoring functions
    function startNetworkMonitoring(flightId) {
        if (networkMonitoringActive) return;
        
        console.log(`[Sidecar InPage] Starting network monitoring for flight ${flightId}`);
        networkMonitoringActive = true;
        currentFlightId = flightId;
        
        // Patch fetch API
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            const response = await originalFetch.apply(this, args);
            
            // Check if this looks like an LLM streaming response
            if (response.headers.get('content-type')?.includes('text/event-stream') ||
                response.headers.get('content-type')?.includes('application/json')) {
                
                console.log(`[Sidecar InPage] Network response detected for flight ${currentFlightId}`);
                notifyResponseDetection('network', { source: 'fetch', url: args[0] });
            }
            
            return response;
        };
        
        // Patch XMLHttpRequest
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            this._sidecarUrl = url;
            return originalXHROpen.call(this, method, url, ...args);
        };
        
        XMLHttpRequest.prototype.send = function(...args) {
            this.addEventListener('readystatechange', function() {
                if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
                    // Check if this looks like an LLM response
                    const contentType = this.getResponseHeader('content-type');
                    if (contentType?.includes('application/json') || 
                        contentType?.includes('text/event-stream') ||
                        this._sidecarUrl?.includes('api') || 
                        this._sidecarUrl?.includes('chat')) {
                        
                        console.log(`[Sidecar InPage] Network response detected via XHR for flight ${currentFlightId}`);
                        notifyResponseDetection('network', { source: 'xhr', url: this._sidecarUrl });
                    }
                }
            });
            
            return originalXHRSend.call(this, ...args);
        };
    }
    
    function stopNetworkMonitoring() {
        if (!networkMonitoringActive) return;
        
        console.log(`[Sidecar InPage] Stopping network monitoring for flight ${currentFlightId}`);
        networkMonitoringActive = false;
        
        // Note: In a production environment, we would restore original functions
        // For now, we just mark monitoring as inactive
    }
    
    // DOM observation functions
    let domObserver = null;
    
    function startDOMObservation(flightId) {
        if (domObserverActive) return;
        
        console.log(`[Sidecar InPage] Starting DOM observation for flight ${flightId}`);
        domObserverActive = true;
        currentFlightId = flightId;
        
        domObserver = new MutationObserver((mutations) => {
            let significantChange = false;
            
            mutations.forEach((mutation) => {
                // Look for text content changes that might indicate response completion
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 10) {
                            significantChange = true;
                        } else if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check for elements that commonly contain LLM responses
                            const responseIndicators = ['message', 'response', 'content', 'text', 'output'];
                            const hasResponseClass = responseIndicators.some(indicator => 
                                node.className?.toLowerCase().includes(indicator) ||
                                node.id?.toLowerCase().includes(indicator)
                            );
                            
                            if (hasResponseClass || node.textContent.trim().length > 50) {
                                significantChange = true;
                            }
                        }
                    });
                }
                
                // Look for attribute changes that might indicate completion
                if (mutation.type === 'attributes') {
                    const completionAttributes = ['data-complete', 'data-done', 'aria-busy'];
                    if (completionAttributes.includes(mutation.attributeName)) {
                        significantChange = true;
                    }
                }
            });
            
            if (significantChange) {
                console.log(`[Sidecar InPage] DOM change detected for flight ${currentFlightId}`);
                notifyResponseDetection('dom', { mutationsCount: mutations.length });
            }
        });
        
        // Observe the entire document for changes
        domObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-complete', 'data-done', 'aria-busy', 'class']
        });
    }
    
    function stopDOMObservation() {
        if (!domObserverActive) return;
        
        console.log(`[Sidecar InPage] Stopping DOM observation for flight ${currentFlightId}`);
        domObserverActive = false;
        
        if (domObserver) {
            domObserver.disconnect();
            domObserver = null;
        }
    }
    
    // Response detection notification
    function notifyResponseDetection(source, metadata = {}) {
        if (!currentFlightId) return;
        
        console.log(`[Sidecar InPage] Response detected via ${source} for flight ${currentFlightId}`);
        
        // Notify background script
        chrome.runtime.sendMessage({
            type: source === 'network' ? NETWORK_RESPONSE_DETECTED : DOM_CHANGE_DETECTED,
            payload: {
                flightId: currentFlightId,
                source,
                timestamp: Date.now(),
                metadata
            }
        });
        
        // Execute any registered callbacks
        const callbacks = responseDetectionCallbacks.get(currentFlightId);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(source, metadata);
                } catch (error) {
                    console.error('[Sidecar InPage] Error in response detection callback:', error);
                }
            });
        }
    }
    
    // Register callback for response detection
    function onResponseDetection(flightId, callback) {
        if (!responseDetectionCallbacks.has(flightId)) {
            responseDetectionCallbacks.set(flightId, []);
        }
        responseDetectionCallbacks.get(flightId).push(callback);
    }
    
    // Clean up callbacks for completed flights
    function cleanupFlightCallbacks(flightId) {
        responseDetectionCallbacks.delete(flightId);
        if (currentFlightId === flightId) {
            stopNetworkMonitoring();
            stopDOMObservation();
            currentFlightId = null;
        }
    }

    // Initialize provider based on current hostname
    async function initializeProvider() {
        if (isInitialized) return;
        
        try {
            const hostname = window.location.hostname;
            console.log(`[Sidecar InPage] Initializing provider for hostname: ${hostname}`);
            
            // Request provider configuration from background script
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    type: GET_PROVIDER_CONFIG,
                    hostname: hostname
                }, resolve);
            });

            if (response && response.config) {
                // Dynamically import and initialize the Provider class
                const { Provider } = await import(chrome.runtime.getURL('src/content/provider.js'));
                currentProvider = new Provider(response.config);
                isInitialized = true;
                
                console.log(`[Sidecar InPage] Provider initialized for: ${response.config.platformKey}`);
                
                // Notify background that provider is ready
                window.postMessage({
                    type: PROVIDER_READY,
                    payload: { platformKey: response.config.platformKey }
                }, '*');
            } else {
                throw new Error(`No configuration found for hostname: ${hostname}`);
            }
        } catch (error) {
            console.error('[Sidecar InPage] Provider initialization failed:', error);
            window.postMessage({
                type: PROVIDER_ERROR,
                payload: { error: error.message }
            }, '*');
        }
    }

    // Handle incoming messages from background script
    window.addEventListener('message', async (event) => {
        if (event.source !== window) return;
        
        const { type, payload } = event.data;
        
        switch (type) {
            case BROADCAST_PROMPT:
                await handleBroadcastPrompt(payload);
                break;
                
            case HARVEST_RESULT:
                await handleHarvestResult(payload);
                break;
        }
    });

    // Handle prompt broadcasting
    async function handleBroadcastPrompt(payload) {
        const { prompt, sessionId, flightId } = payload;
        
        if (!currentProvider) {
            console.error('[Sidecar InPage] No provider available for broadcast');
            return;
        }
        
        try {
            console.log(`[Sidecar InPage] Broadcasting prompt for flight ${flightId}: ${prompt.substring(0, 50)}...`);
            
            // Start hybrid monitoring before broadcasting
            startNetworkMonitoring(flightId);
            startDOMObservation(flightId);
            
            const result = await currentProvider.broadcast(prompt);
            
            // Notify background of successful broadcast
            chrome.runtime.sendMessage({
                type: BROADCAST_COMPLETE,
                payload: { sessionId, flightId, success: true, result }
            });
        } catch (error) {
            console.error('[Sidecar InPage] Broadcast failed:', error);
            
            // Clean up monitoring on failure
            cleanupFlightCallbacks(flightId);
            
            chrome.runtime.sendMessage({
                type: BROADCAST_COMPLETE,
                payload: { sessionId, flightId, success: false, error: error.message }
            });
        }
    }

    // Handle result harvesting
    async function handleHarvestResult(payload) {
        const { sessionId, flightId } = payload;
        
        if (!currentProvider) {
            console.error('[Sidecar InPage] No provider available for harvest');
            return;
        }
        
        try {
            console.log(`[Sidecar InPage] Starting result harvest for flight ${flightId}`);
            const result = await currentProvider.harvest();
            
            // Clean up monitoring after successful harvest
            cleanupFlightCallbacks(flightId);
            
            // Send harvested result to background
            chrome.runtime.sendMessage({
                type: HARVEST_COMPLETE,
                payload: { sessionId, flightId, result }
            });
        } catch (error) {
            console.error('[Sidecar InPage] Harvest failed:', error);
            
            // Clean up monitoring on failure
            cleanupFlightCallbacks(flightId);
            
            chrome.runtime.sendMessage({
                type: HARVEST_COMPLETE,
                payload: { sessionId, flightId, success: false, error: error.message }
            });
        }
    }

    // Initialize provider when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeProvider);
    } else {
        initializeProvider();
    }

})();