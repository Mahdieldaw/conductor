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