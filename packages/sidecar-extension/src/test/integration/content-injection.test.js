// Example test structure
export class ContentInjectionTester {
  static async testInjectionFlow(providerKey) {
    const results = {
      tabFound: false,
      injectionSuccessful: false,
      healthCheckPassed: false,
      messageDelivered: false,
      errors: []
    };
    
    try {
      // Test tab finding
      const tab = await findTabByPlatform(providerKey);
      results.tabFound = !!tab;
      
      if (tab) {
        // Test injection
        await injectContentModuleWithVerification(tab.tabId);
        results.injectionSuccessful = true;
        
        // Test health check
        const health = await chrome.tabs.sendMessage(tab.tabId, { type: 'HEALTH_CHECK' });
        results.healthCheckPassed = health?.healthy;
        
        // Test actual message
        const response = await sendMessageWithRetry(tab.tabId, {
          type: CHECK_READINESS,
          payload: { config: getProviderConfig(providerKey) }
        });
        results.messageDelivered = !!response;
      }
    } catch (error) {
      results.errors.push(error.message);
    }
    
    return results;
  }
}