// Enhanced types with detailed status management
export interface ProviderConfig {
  id: string;
  name: string;
  logoColor: string;
  url: string; // Default URL to open for this provider
}

// Normalized status values with clear semantics
export type ProviderStatus = 
  | 'ready'           // Provider is active and ready to receive prompts
  | 'offline'         // Provider tab is not available/detected
  | 'checking'        // Currently performing readiness check
  | 'login_required'  // Provider tab exists but user needs to authenticate
  | 'tab_not_open'    // Provider tab needs to be opened
  | 'network_error'   // Network/connection issues
  | 'service_error'   // Provider service returned an error
  | 'timeout_error';  // Readiness check timed out

export interface Provider extends ProviderConfig {
  status: ProviderStatus;
  statusMessage?: string;
  lastChecked?: Date;
  isCheckInProgress?: boolean;
}

export interface ResponseState {
  status: 'pending' | 'completed' | 'error';
  data?: string;
  error?: string;
}

export interface PromptState {
  text: string;
  targetProviders: string[];
  status: 'composing' | 'executing' | 'completed' | 'error';
  responses: Map<string, ResponseState>;
  manuallyDeselected: Set<string>; // Track manual deselections
}

// Readiness check result from the service
export interface ReadinessCheckResult {
  status: string; // Raw status from service (might be uppercase)
  message?: string;
  data?: {
    url?: string;
    tabId?: number;
  };
}