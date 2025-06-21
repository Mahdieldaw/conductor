import type { ProviderStatus, ReadinessCheckResult } from '../types';

// Status mapping from service responses to normalized internal states
const STATUS_MAP: Record<string, ProviderStatus> = {
  'READY': 'ready',
  'ONLINE': 'ready',
  'AVAILABLE': 'ready',
  'OK': 'ready',
  
  'OFFLINE': 'offline',
  'UNAVAILABLE': 'offline',
  'NOT_FOUND': 'offline',
  
  'LOGIN_REQUIRED': 'login_required',
  'AUTHENTICATION_REQUIRED': 'login_required',
  'UNAUTHORIZED': 'login_required',
  
  'TAB_NOT_OPEN': 'tab_not_open',
  'TAB_CLOSED': 'tab_not_open',
  'PAGE_NOT_LOADED': 'tab_not_open',
  
  'NETWORK_ERROR': 'network_error',
  'CONNECTION_ERROR': 'network_error',
  'CONNECTION_FAILED': 'network_error',
  
  'SERVICE_ERROR': 'service_error',
  'PROVIDER_ERROR': 'service_error',
  'API_ERROR': 'service_error',
  
  'TIMEOUT': 'timeout_error',
  'TIMEOUT_ERROR': 'timeout_error',
  'REQUEST_TIMEOUT': 'timeout_error',
};

export function normalizeStatus(rawStatus: string): ProviderStatus {
  const normalizedKey = rawStatus.toUpperCase().trim();
  return STATUS_MAP[normalizedKey] || 'service_error';
}

export function getStatusDisplay(status: ProviderStatus) {
  switch (status) {
    case 'ready':
      return { 
        color: 'bg-green-500', 
        icon: '\u2705', 
        tooltip: 'Ready',
        isActionable: false,
        isSelectable: true 
      };
    case 'checking':
      return { 
        color: 'bg-blue-500 animate-pulse', 
        icon: '\u23f1', 
        tooltip: 'Checking status...',
        isActionable: false,
        isSelectable: false 
      };
    case 'login_required':
      return { 
        color: 'bg-amber-500', 
        icon: '\ud83d\udd12', 
        tooltip: 'Login required - click to focus tab',
        isActionable: true,
        isSelectable: false 
      };
    case 'tab_not_open':
      return { 
        color: 'bg-blue-600', 
        icon: '\ud83d\udd17', 
        tooltip: 'Tab not open - click to open',
        isActionable: true,
        isSelectable: false 
      };
    case 'network_error':
      return { 
        color: 'bg-red-500', 
        icon: '\ud83c\udf10', 
        tooltip: 'Network error - click to retry',
        isActionable: true,
        isSelectable: false 
      };
    case 'service_error':
      return { 
        color: 'bg-red-600', 
        icon: '\u26a0\ufe0f', 
        tooltip: 'Service error - click to retry',
        isActionable: true,
        isSelectable: false 
      };
    case 'timeout_error':
      return { 
        color: 'bg-orange-500', 
        icon: '\u23f0', 
        tooltip: 'Check timed out - click to retry',
        isActionable: true,
        isSelectable: false 
      };
    case 'offline':
    default:
      return { 
        color: 'bg-gray-500', 
        icon: '\u274c', 
        tooltip: 'Offline - click to retry',
        isActionable: true,
        isSelectable: false 
      };
  }
}

export function getStatusMessage(status: ProviderStatus, providerName: string): string {
  switch (status) {
    case 'ready':
      return `${providerName} is ready to receive prompts`;
    case 'checking':
      return `Checking ${providerName} status...`;
    case 'login_required':
      return `Please log in to ${providerName}`;
    case 'tab_not_open':
      return `${providerName} tab needs to be opened`;
    case 'network_error':
      return `Network connection to ${providerName} failed`;
    case 'service_error':
      return `${providerName} service returned an error`;
    case 'timeout_error':
      return `${providerName} readiness check timed out`;
    case 'offline':
    default:
      return `${providerName} is not available`;
  }
}