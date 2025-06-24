// This script is injected into the content page and is responsible for
// injecting the inpage-boot.js script into the main world.

console.log('content-script-bridge.js loaded');

(function() {
    // Inject the inpage script
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/content/inpage-boot.js');
    (document.head || document.documentElement).appendChild(script);

    // Listen for messages from the service worker and forward them to the page
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        window.postMessage(message, '*');
        return true; // Keep the message channel open for async response
    });

    // Listen for messages from the page and forward them to the service worker
    window.addEventListener('message', (event) => {
        // We only accept messages from ourselves
        if (event.source !== window) {
            return;
        }
        chrome.runtime.sendMessage(event.data);
    });
})();