/**
 * Configuration for content script injection.
 */
export const INJECTION_CONFIG = {
  MAX_RETRIES: 3,
  BASE_TIMEOUT: 1000,
  MAX_TIMEOUT: 5000,
  HEALTH_CHECK_TIMEOUT: 2000,
  EXPONENTIAL_BACKOFF_BASE: 500,
  PROGRESSIVE_TIMEOUT_MULTIPLIER: 1.5
};

/**
 * Configuration for messaging between the service worker and content scripts.
 */
export const MESSAGE_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000,
  CONNECTION_TIMEOUT: 5000
};