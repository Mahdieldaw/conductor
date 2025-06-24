// packages/sidecar-extension/src/background/utils/config-manager.js
// Centralized configuration manager for provider configs

/**
 * Centralized configuration manager that loads, caches, and provides
 * access to provider configurations throughout the extension.
 */
/**
 * Manages the loading, caching, and access of provider configurations.
 * This class ensures that configurations are loaded only once and provides
 * convenient methods to access them from different parts of the extension.
 */
class ConfigManager {
  /**
   * Initializes a new instance of the ConfigManager.
   */
  constructor() {
    this.configs = new Map();
    this.providerToHostnamesMap = new Map();
    this.hostnameToProviderMap = new Map();
    this.isInitialized = false;
    this.initializationPromise = null;
    console.log('[ConfigManager] Initialized.');
  }

  /**
   * Initializes the configuration manager by loading all provider configs.
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = this._loadAllConfigs();
    await this.initializationPromise;
    this.isInitialized = true;
  }

  /**
   * Loads all provider configuration files.
   * @private
   */
  async _loadAllConfigs() {
    const configNames = ['chatgpt', 'claude']; // Add more providers as needed
    const loadPromises = configNames.map(name => this._loadConfig(name));
    
    try {
      await Promise.all(loadPromises);
      this._buildHostnameMaps();
      console.log('[ConfigManager] All configurations loaded successfully.');
      console.log('[ConfigManager] Provider->Hostnames mapping:', Object.fromEntries(this.providerToHostnamesMap));
    } catch (error) {
      console.error('[ConfigManager] Failed to load configurations:', error);
      throw error;
    }
  }

  /**
   * Loads a single provider configuration file.
   * @param {string} providerKey - The provider key (e.g., 'chatgpt', 'claude')
   * @private
   */
  async _loadConfig(providerKey) {
    try {
      const url = chrome.runtime.getURL(`content/configs/${providerKey}.json`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch config for ${providerKey}: ${response.status}`);
      }
      
      const config = await response.json();
      
      // Validate required fields
      if (!config.providerKey || !Array.isArray(config.hostnames)) {
        throw new Error(`Invalid config for ${providerKey}: missing providerKey or hostnames`);
      }
      
      this.configs.set(providerKey, config);
      console.log(`[ConfigManager] Loaded config for ${providerKey}`);
    } catch (error) {
      console.error(`[ConfigManager] Failed to load config for ${providerKey}:`, error);
      throw error;
    }
  }

  /**
   * Builds hostname mapping tables for quick lookups.
   * @private
   */
  _buildHostnameMaps() {
    this.providerToHostnamesMap.clear();
    this.hostnameToProviderMap.clear();
    
    for (const [providerKey, config] of this.configs) {
      if (config.hostnames && Array.isArray(config.hostnames)) {
        this.providerToHostnamesMap.set(providerKey, config.hostnames);
        
        for (const hostname of config.hostnames) {
          this.hostnameToProviderMap.set(hostname, providerKey);
        }
      }
    }
  }

  /**
   * Gets a provider configuration by key.
   * @param {string} providerKey - The provider key
   * @returns {Promise<Object|null>} The provider configuration or null if not found
   */
  async getConfig(providerKey) {
    await this.initialize();
    return this.configs.get(providerKey) || null;
  }

  /**
   * Gets all loaded configurations.
   * @returns {Promise<Map<string, Object>>} Map of all configurations
   */
  async getAllConfigs() {
    await this.initialize();
    return new Map(this.configs);
  }

  /**
   * Gets the provider key for a given hostname.
   * @param {string} hostname - The hostname to look up
   * @returns {Promise<string|null>} The provider key or null if not found
   */
  async getProviderKeyFromHostname(hostname) {
    await this.initialize();
    return this.hostnameToProviderMap.get(hostname) || null;
  }

  /**
   * Gets all hostnames for a given provider.
   * @param {string} providerKey - The provider key
   * @returns {Promise<string[]>} Array of hostnames for the provider
   */
  async getHostnamesForProvider(providerKey) {
    await this.initialize();
    return this.providerToHostnamesMap.get(providerKey) || [];
  }

  /**
   * Gets URL patterns for chrome.tabs.query for a given provider.
   * @param {string} providerKey - The provider key
   * @returns {Promise<string[]>} Array of URL patterns
   */
  async getUrlPatternsForProvider(providerKey) {
    const hostnames = await this.getHostnamesForProvider(providerKey);
    return hostnames.map(hostname => `*://${hostname}/*`);
  }

  /**
   * Checks if a URL belongs to a supported provider.
   * @param {string} url - The URL to check
   * @returns {Promise<{providerKey: string|null, hostname: string|null}>} Provider info
   */
  async getProviderInfoFromUrl(url) {
    await this.initialize();
    
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const providerKey = this.hostnameToProviderMap.get(hostname);
      
      return {
        providerKey: providerKey || null,
        hostname: hostname
      };
    } catch (error) {
      console.warn('[ConfigManager] Invalid URL provided:', url);
      return {
        providerKey: null,
        hostname: null
      };
    }
  }

  /**
   * Gets selectors for a specific target from a provider config.
   * @param {string} providerKey - The provider key
   * @param {string} selectorTarget - The selector target (e.g., 'input', 'sendButton')
   * @returns {Promise<string[]|null>} Array of selectors or null if not found
   */
  async getSelectors(providerKey, selectorTarget) {
    const config = await this.getConfig(providerKey);
    if (!config || !config.selectors || !config.selectors[selectorTarget]) {
      return null;
    }
    return config.selectors[selectorTarget];
  }

  /**
   * Gets the broadcast strategy for a provider.
   * @param {string} providerKey - The provider key
   * @returns {Promise<Array|null>} Broadcast strategy steps or null if not found
   */
  async getBroadcastStrategy(providerKey) {
    const config = await this.getConfig(providerKey);
    if (!config || !config.broadcastStrategy) {
      return null;
    }
    return config.broadcastStrategy;
  }

  /**
   * Retrieves the harvesting strategy for a given provider.
   *
   * @param {string} providerKey - The key of the provider.
   * @returns {Promise<object|null>} A promise that resolves with the harvest strategy object, or null if not found.
   */
  async getHarvestStrategy(providerKey) {
    const config = await this.getConfig(providerKey);
    if (!config || !config.harvestStrategy) {
      return null;
    }
    return config.harvestStrategy;
  }

  /**
   * Retrieves the strategy for starting a new chat for a given provider.
   *
   * @param {string} providerKey - The key of the provider.
   * @returns {Promise<Array|null>} A promise that resolves with the new chat strategy, or null if not found.
   */
  async getNewChatStrategy(providerKey) {
    const config = await this.getConfig(providerKey);
    if (!config || !config.newChatStrategy) {
      return null;
    }
    return config.newChatStrategy;
  }

  /**
   * Retrieves the readiness check configuration for a given provider.
   *
   * @param {string} providerKey - The key of the provider.
   * @returns {Promise<object|null>} A promise that resolves with the readiness configuration, or null if not found.
   */
  async getReadinessConfig(providerKey) {
    const config = await this.getConfig(providerKey);
    if (!config || !config.readinessCheck) {
      return null;
    }
    return config.readinessCheck;
  }

  /**
   * Gets timing configuration for a provider.
   * @param {string} providerKey - The provider key
   * @returns {Promise<Object|null>} Timing configuration or null if not found
   */
  async getTimingConfig(providerKey) {
    const config = await this.getConfig(providerKey);
    if (!config || !config.harvestStrategy || !config.harvestStrategy.timing) {
      return null;
    }
    return config.harvestStrategy.timing;
  }

  /**
   * Gets tab activation configuration for a provider.
   * @param {string} providerKey - The provider key
   * @returns {Promise<Object|null>} Tab activation config or null if not found
   */
  async getTabActivationConfig(providerKey) {
    const config = await this.getConfig(providerKey);
    if (!config || !config.tabActivation) {
      return null;
    }
    return config.tabActivation;
  }

  /**
   * Reloads a specific provider configuration.
   * @param {string} providerKey - The provider key to reload
   * @returns {Promise<void>}
   */
  async reloadConfig(providerKey) {
    try {
      await this._loadConfig(providerKey);
      this._buildHostnameMaps();
      console.log(`[ConfigManager] Reloaded config for ${providerKey}`);
    } catch (error) {
      console.error(`[ConfigManager] Failed to reload config for ${providerKey}:`, error);
      throw error;
    }
  }

  /**
   * Reloads all configurations.
   * @returns {Promise<void>}
   */
  async reloadAllConfigs() {
    this.configs.clear();
    this.isInitialized = false;
    this.initializationPromise = null;
    await this.initialize();
  }

  /**
   * Gets a list of all supported provider keys.
   * @returns {Promise<string[]>} Array of provider keys
   */
  async getSupportedProviders() {
    await this.initialize();
    return Array.from(this.configs.keys());
  }

  /**
   * Validates if a provider configuration is complete and valid.
   * @param {string} providerKey - The provider key to validate
   * @returns {Promise<{valid: boolean, errors: string[]}>} Validation result
   */
  async validateConfig(providerKey) {
    const config = await this.getConfig(providerKey);
    const errors = [];
    
    if (!config) {
      return { valid: false, errors: [`Config not found for provider: ${providerKey}`] };
    }
    
    // Check required fields
    if (!config.providerKey) errors.push('Missing providerKey');
    if (!Array.isArray(config.hostnames) || config.hostnames.length === 0) {
      errors.push('Missing or empty hostnames array');
    }
    if (!config.selectors) errors.push('Missing selectors object');
    if (!config.broadcastStrategy) errors.push('Missing broadcastStrategy');
    if (!config.harvestStrategy) errors.push('Missing harvestStrategy');
    
    // Check essential selectors
    const essentialSelectors = ['input', 'sendButton', 'responseContainer'];
    for (const selector of essentialSelectors) {
      if (!config.selectors?.[selector]) {
        errors.push(`Missing essential selector: ${selector}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Create and export singleton instance
export const configManager = new ConfigManager();

// Export class for testing
export { ConfigManager };