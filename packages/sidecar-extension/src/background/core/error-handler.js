/**
 * Error Handler - Centralized error handling and harmonization
 * 
 * This module provides consistent error handling across the extension,
 * including error sanitization, categorization, and recovery suggestions.
 * This addresses the "Harmonize error messages" goal from Phase 4.
 */

import errorMessages from '../config/error-messages.json';

/**
 * Error categories for consistent handling
 */
export const ErrorCategories = {
  VALIDATION: 'validation',
  NETWORK: 'network',
  PERMISSION: 'permission',
  TAB_NOT_FOUND: 'tab_not_found',
  SCRIPT_EXECUTION: 'script_execution',
  SESSION: 'session',
  TIMEOUT: 'timeout',
  UNKNOWN: 'unknown'
};

/**
 * Main error handler function
 * @param {Error} error - The error to handle
 * @param {Object} context - Request context
 * @returns {Object} Processed error information
 */
export function handleError(error, context = {}) {
  const processedError = {
    message: sanitizeErrorMessage(error.message || 'Unknown error'),
    category: categorizeError(error),
    isRecoverable: isRecoverable(error),
    suggestion: getSuggestion(error),
    requestId: context.requestId,
    timestamp: Date.now(),
    originalStack: error.stack
  };

  // Log the processed error
  console.error('[ErrorHandler] Processed error:', {
    ...processedError,
    originalStack: undefined // Don't log stack in summary
  });

  return processedError;
}

/**
 * Sanitizes error messages to remove sensitive information
 * @param {string} message - Raw error message
 * @returns {string} Sanitized error message
 */
export function sanitizeErrorMessage(message) {
  if (!message || typeof message !== 'string') {
    return 'An unknown error occurred';
  }

  // Remove file paths that might contain sensitive information
  let sanitized = message.replace(/[A-Za-z]:\\[^\s]+/g, '[FILE_PATH]');
  sanitized = sanitized.replace(/\/[^\s]+\//g, '[FILE_PATH]/');
  
  // Remove potential API keys or tokens
  sanitized = sanitized.replace(/[a-zA-Z0-9]{32,}/g, '[TOKEN]');
  
  // Remove URLs that might contain sensitive query parameters
  sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, '[URL]');
  
  // Standardize common error patterns

  for (const [pattern, replacement] of Object.entries(errorMessages)) {
    if (sanitized.includes(pattern)) {
      return replacement;
    }
  }

  return sanitized;
}

/**
 * Categorizes errors for consistent handling
 * @param {Error} error - The error to categorize
 * @returns {string} Error category
 */
function categorizeError(error) {
  const message = error.message || '';
  const stack = error.stack || '';

  // Validation errors
  if (message.includes('Validation failed') || 
      message.includes('Required property') ||
      message.includes('must be of type')) {
    return ErrorCategories.VALIDATION;
  }

  // Network/connection errors
  if (message.includes('Could not establish connection') ||
      message.includes('Extension context invalidated') ||
      message.includes('network') ||
      message.includes('fetch')) {
    return ErrorCategories.NETWORK;
  }

  // Permission errors
  if (message.includes('Cannot access contents') ||
      message.includes('permission') ||
      message.includes('not allowed')) {
    return ErrorCategories.PERMISSION;
  }

  // Tab-related errors
  if (message.includes('No tab with id') ||
      message.includes('tab was closed') ||
      message.includes('No active tab')) {
    return ErrorCategories.TAB_NOT_FOUND;
  }

  // Script execution errors
  if (message.includes('script') ||
      message.includes('executeScript') ||
      stack.includes('chrome.scripting')) {
    return ErrorCategories.SCRIPT_EXECUTION;
  }

  // Session errors
  if (message.includes('session') ||
      message.includes('Session') ||
      message.includes('sessionId')) {
    return ErrorCategories.SESSION;
  }

  // Timeout errors
  if (message.includes('timeout') ||
      message.includes('Timeout') ||
      error.name === 'TimeoutError') {
    return ErrorCategories.TIMEOUT;
  }

  return ErrorCategories.UNKNOWN;
}

/**
 * Determines if an error is recoverable
 * @param {Error} error - The error to check
 * @returns {boolean} True if the error is potentially recoverable
 */
export function isRecoverable(error) {
  const category = categorizeError(error);
  
  // These error types are generally recoverable
  const recoverableCategories = [
    ErrorCategories.NETWORK,
    ErrorCategories.TAB_NOT_FOUND,
    ErrorCategories.SESSION,
    ErrorCategories.TIMEOUT
  ];

  return recoverableCategories.includes(category);
}

/**
 * Provides recovery suggestions based on error type
 * @param {Error} error - The error to provide suggestions for
 * @returns {string} Recovery suggestion
 */
export function getSuggestion(error) {
  const category = categorizeError(error);
  
  const suggestions = {
    [ErrorCategories.VALIDATION]: 'Please check your input and try again.',
    [ErrorCategories.NETWORK]: 'Please check your internet connection and try again.',
    [ErrorCategories.PERMISSION]: 'Please ensure the extension has permission to access this page.',
    [ErrorCategories.TAB_NOT_FOUND]: 'Please select an active tab and try again.',
    [ErrorCategories.SCRIPT_EXECUTION]: 'Please refresh the page and try again.',
    [ErrorCategories.SESSION]: 'Please reset your session and try again.',
    [ErrorCategories.TIMEOUT]: 'The operation timed out. Please try again.',
    [ErrorCategories.UNKNOWN]: 'Please try again. If the problem persists, contact support.'
  };

  return suggestions[category] || suggestions[ErrorCategories.UNKNOWN];
}

/**
 * Creates a standardized error response
 * @param {Error} error - The error to format
 * @param {Object} context - Request context
 * @returns {Object} Standardized error response
 */
export function createErrorResponse(error, context = {}) {
  const processedError = handleError(error, context);
  
  return {
    success: false,
    error: processedError.message,
    category: processedError.category,
    isRecoverable: processedError.isRecoverable,
    suggestion: processedError.suggestion,
    requestId: processedError.requestId
  };
}