export class ErrorTracker {
  static errors = new Map();
  static ERROR_CATEGORIES = {
    CONNECTION: 'connection',
    INJECTION: 'injection', 
    TAB_MANAGEMENT: 'tab_management',
    PROVIDER: 'provider',
    TIMEOUT: 'timeout'
  };
  
  static categorizeError(error) {
    const message = error.message.toLowerCase();
    if (message.includes('could not establish connection')) {
      return this.ERROR_CATEGORIES.CONNECTION;
    }
    if (message.includes('inject')) {
      return this.ERROR_CATEGORIES.INJECTION;
    }
    if (message.includes('tab')) {
      return this.ERROR_CATEGORIES.TAB_MANAGEMENT;
    }
    if (message.includes('timeout')) {
      return this.ERROR_CATEGORIES.TIMEOUT;
    }
    return 'unknown';
  }
  
  static track(error, context = {}) {
    const category = this.categorizeError(error);
    const key = `${category}:${error.message}`;
    const existing = this.errors.get(key) || { 
      count: 0, 
      lastSeen: null, 
      contexts: [],
      category 
    };
    
    existing.count++;
    existing.lastSeen = Date.now();
    existing.contexts.push({ ...context, timestamp: Date.now() });
    
    this.errors.set(key, existing);
    
    // Alert on frequent errors
    if (existing.count === 5) {
      console.error(`[ErrorTracker] Frequent ${category} error:`, error.message, existing);
    }
  }
  
  static getHealthReport() {
    const report = {
      totalErrors: this.errors.size,
      categories: {},
      recentErrors: []
    };
    
    for (const [key, data] of this.errors) {
      if (!report.categories[data.category]) {
        report.categories[data.category] = 0;
      }
      report.categories[data.category] += data.count;
      
      if (Date.now() - data.lastSeen < 60000) { // Last minute
        report.recentErrors.push({ key, ...data });
      }
    }
    
    return report;
  }
}