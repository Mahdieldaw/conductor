// packages/sidecar-extension/src/content/utils/dom-utils.js
// Core DOM utility functions for the Sidecar extension

/**
 * Searches for an element using an array of selectors, including Shadow DOM support.
 * @param {string[]} selectorArray - Array of CSS selectors to try
 * @param {Document|ShadowRoot} root - Root element to search from (defaults to document)
 * @returns {Element|null} Found element or null
 */
export function querySelector(selectorArray, root = document) {
  if (!selectorArray || !Array.isArray(selectorArray)) return null;

  const findElement = (selectors, searchRoot) => {
    for (const selector of selectors) {
      try {
        // Check the current root
        const element = searchRoot.querySelector(selector);
        if (element) return element;
      } catch (e) {
        // This can happen with invalid selectors, especially during development
        console.warn(`[DOM Utils] Invalid selector: ${selector}`, e);
        continue; // Try the next selector
      }
    }

    // If not found, search inside all shadow roots in the current root
    const shadowRoots = searchRoot.querySelectorAll('*');
    for (const element of shadowRoots) {
      if (element.shadowRoot) {
        const foundInShadow = findElement(selectors, element.shadowRoot);
        if (foundInShadow) return foundInShadow;
      }
    }

    return null;
  };

  return findElement(selectorArray, root);
}

/**
 * Waits for an element to appear in the DOM.
 * @param {string[]} selectorArray - Array of CSS selectors to try
 * @param {number} timeout - Timeout in milliseconds (default: 7000)
 * @param {Document|ShadowRoot} root - Root element to search from (defaults to document)
 * @returns {Promise<Element>} Promise that resolves with the found element
 */
export function waitForElement(selectorArray, timeout = 7000, root = document) {
  return new Promise((resolve, reject) => {
    let el = querySelector(selectorArray, root);
    if (el) return resolve(el);

    const observer = new MutationObserver(() => {
      el = querySelector(selectorArray, root);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(root === document ? document.body : root, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element not found after ${timeout}ms for selectors: ${selectorArray.join(' OR ')}`));
    }, timeout);
  });
}

/**
 * Simulates user input on an element (supports both input elements and contentEditable).
 * @param {Element} element - The target element
 * @param {string} text - Text to input
 * @param {Object} options - Additional options
 * @param {boolean} options.focus - Whether to focus the element first (default: true)
 * @param {boolean} options.clear - Whether to clear existing content first (default: true)
 */
export function simulateInput(element, text, options = {}) {
  const { focus = true, clear = true } = options;

  if (!element) {
    throw new Error('Cannot simulate input on a null element.');
  }

  if (focus) {
    element.focus();
  }

  // Handle different types of input elements
  if (typeof element.value !== 'undefined') {
    // Standard input/textarea elements
    if (clear) element.value = '';
    element.value = text;
    
    // Dispatch input events
    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  } else if (element.isContentEditable) {
    // ContentEditable elements
    if (clear) element.textContent = '';
    element.textContent = text;
    
    // Dispatch input events for contentEditable
    element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
  } else {
    throw new Error('Target element is not a standard input or contentEditable.');
  }
}

/**
 * Simulates a click on an element with optional validation.
 * @param {Element} element - The target element
 * @param {Object} options - Additional options
 * @param {boolean} options.checkDisabled - Whether to check if element is disabled (default: true)
 * @param {boolean} options.focus - Whether to focus before clicking (default: false)
 */
export function simulateClick(element, options = {}) {
  const { checkDisabled = true, focus = false } = options;

  if (!element) {
    throw new Error('Cannot click on a null element.');
  }

  if (checkDisabled && element.disabled) {
    throw new Error('Element is disabled and cannot be clicked.');
  }

  if (focus) {
    element.focus();
  }

  element.click();
}

/**
 * Creates an abortable delay that can be cancelled via AbortSignal.
 * @param {number} ms - Delay in milliseconds
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<void>} Promise that resolves after the delay
 */
export function abortableDelay(ms, signal = null) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Delay aborted'));
      return;
    }

    const timeoutId = setTimeout(() => {
      if (signalListener) signal?.removeEventListener('abort', signalListener);
      resolve();
    }, ms);

    const signalListener = signal ? () => {
      clearTimeout(timeoutId);
      signal.removeEventListener('abort', signalListener);
      reject(new Error('Delay aborted'));
    } : null;

    if (signalListener) {
      signal.addEventListener('abort', signalListener);
    }
  });
}

/**
 * Checks if an element is visible in the viewport.
 * @param {Element} element - The element to check
 * @returns {boolean} True if element is visible
 */
export function isElementVisible(element) {
  if (!element) return false;

  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== 'hidden' &&
    style.display !== 'none' &&
    rect.top < window.innerHeight &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.right > 0
  );
}

/**
 * Waits for an element to become visible.
 * @param {string[]} selectorArray - Array of CSS selectors to try
 * @param {number} timeout - Timeout in milliseconds (default: 7000)
 * @returns {Promise<Element>} Promise that resolves with the visible element
 */
export function waitForVisibleElement(selectorArray, timeout = 7000) {
  return new Promise((resolve, reject) => {
    const checkVisibility = () => {
      const el = querySelector(selectorArray);
      if (el && isElementVisible(el)) {
        return el;
      }
      return null;
    };

    let el = checkVisibility();
    if (el) return resolve(el);

    const observer = new MutationObserver(() => {
      el = checkVisibility();
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Visible element not found after ${timeout}ms for selectors: ${selectorArray.join(' OR ')}`));
    }, timeout);
  });
}

/**
 * Extracts text content from an element, handling various content types.
 * @param {Element} element - The element to extract text from
 * @param {Object} options - Extraction options
 * @param {boolean} options.preserveFormatting - Whether to preserve line breaks and spacing
 * @returns {string} Extracted text content
 */
export function extractTextContent(element, options = {}) {
  const { preserveFormatting = false } = options;

  if (!element) return '';

  if (preserveFormatting) {
    // Preserve formatting by converting HTML to text with line breaks
    const clone = element.cloneNode(true);
    
    // Convert block elements to line breaks
    const blockElements = clone.querySelectorAll('div, p, br, h1, h2, h3, h4, h5, h6');
    blockElements.forEach(el => {
      if (el.tagName === 'BR') {
        el.replaceWith('\n');
      } else {
        el.insertAdjacentText('afterend', '\n');
      }
    });
    
    return clone.textContent || clone.innerText || '';
  } else {
    return element.textContent || element.innerText || '';
  }
}

/**
 * Debounces a function call.
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}