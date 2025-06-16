// src/content/primitives/helpers.js
export async function waitForElement(selector, timeout = 8000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error(`Element with selector "${selector}" not found within ${timeout}ms`);
}