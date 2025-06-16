// src/content/providers/BaseProvider.js
export class BaseProvider {
    constructor(config) {
      this.config = config;
      // We keep the timeout configuration, as it's still useful.
      this.baseTimeout = config.baseTimeout || 8000;
    }
  
    // The waitForCondition helper is still extremely valuable.
    async waitForCondition(conditionFn, timeout = this.baseTimeout, interval = 200) {
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        if (await conditionFn()) return true;
        await new Promise(resolve => setTimeout(resolve, interval));
      }
      throw new Error(`Condition not met within ${timeout}ms`);
    }
  }