// packages/shared-messaging/index.js
export const PING = 'PING';
export const EXECUTE_PROMPT = 'EXECUTE_PROMPT'; // The full "broadcast and harvest" flow
export const HARVEST_RESPONSE = 'HARVEST_RESPONSE'; // Just harvest the latest response
export const BROADCAST_PROMPT = 'BROADCAST_PROMPT'; // Just send the prompt, do not harvest
export const TASK_COMPLETE = 'TASK_COMPLETE'; // This might be used by the web app later
export const GET_AVAILABLE_TABS = 'GET_AVAILABLE_TABS';

// New message types for session management
export const RESET_SESSION = 'RESET_SESSION'; // UI to Service Worker
export const START_NEW_CHAT = 'START_NEW_CHAT'; // Service Worker to Content Script

// New message types for readiness pipeline
export const CHECK_READINESS = 'CHECK_READINESS'; // UI to Service Worker
export const ATTEMPT_RECOVERY = 'ATTEMPT_RECOVERY'; // Service Worker to Content Script

// Workflow engine message types
export const EXECUTE_WORKFLOW = 'EXECUTE_WORKFLOW';
export const WORKFLOW_STATUS = 'WORKFLOW_STATUS';
export const WORKFLOW_RESULT = 'WORKFLOW_RESULT';
export const GET_HOT_CACHE = 'GET_HOT_CACHE';
export const GET_FULL_HISTORY = 'GET_FULL_HISTORY';

// Provider configuration message types
export const GET_PROVIDER_CONFIG = 'GET_PROVIDER_CONFIG';
export const HEALTH_CHECK = 'HEALTH_CHECK';

// Error handling message types
export const PROMPT_ERROR = 'PROMPT_ERROR';
export const FLIGHT_ID_ACK = 'FLIGHT_ID_ACK';

// Legacy/Alternative message types (for compatibility)
export const DOM_HARVEST_DONE = 'DOM_HARVEST_DONE';

// Phase 3: Hybrid harvesting orchestration message types
export const NETWORK_RESPONSE_DETECTED = 'NETWORK_RESPONSE_DETECTED';
export const DOM_CHANGE_DETECTED = 'DOM_CHANGE_DETECTED';
export const STREAM_DONE = 'STREAM_DONE';
export const HARVEST_COMPLETE = 'HARVEST_COMPLETE';
export const BROADCAST_COMPLETE = 'BROADCAST_COMPLETE';
export const PROVIDER_READY = 'PROVIDER_READY';
export const PROVIDER_ERROR = 'PROVIDER_ERROR';
export const HARVEST_RESULT = 'HARVEST_RESULT';
