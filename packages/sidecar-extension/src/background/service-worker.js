// packages/sidecar-extension/src/background/service-worker.refactored.js
// Refactored service worker using the new router and middleware architecture

import { createMessageRouter } from './core/message-router.js';
import { handleError } from './core/error-handler.js';
import { loggingMiddleware, metricsMiddleware, validationMiddleware, createMiddleware } from './core/middleware.js';
import * as promptDomain from './domains/prompt/index.js';
import * as readinessDomain from './domains/readiness/index.js';
import * as sessionDomain from './domains/session/index.js';
import * as systemDomain from './domains/system/index.js';
import * as workflowDomain from './domains/workflow/index.js';
import * as memoryDomain from './domains/memory/index.js';
import {
  EXECUTE_PROMPT,
  HARVEST_RESPONSE,
  BROADCAST_PROMPT,
  CHECK_READINESS,
  ATTEMPT_RECOVERY,
  GET_AVAILABLE_TABS,
  RESET_SESSION,
  PING,
  EXECUTE_WORKFLOW,
  WORKFLOW_STATUS,
  WORKFLOW_RESULT,
  GET_HOT_CACHE,
  GET_FULL_HISTORY
} from '@hybrid-thinking/messaging';
import { tabManager } from './utils/tab-manager.js'; // Import tabManager

// Create router with domain handlers and middleware
const router = createMessageRouter({
  [PING]: systemDomain.ping,
  [GET_AVAILABLE_TABS]: systemDomain.getAvailableTabs,
  [RESET_SESSION]: sessionDomain.reset,
  [EXECUTE_PROMPT]: promptDomain.execute,
  [BROADCAST_PROMPT]: promptDomain.broadcast,
  [HARVEST_RESPONSE]: promptDomain.harvest,
  [CHECK_READINESS]: readinessDomain.check,
  [ATTEMPT_RECOVERY]: readinessDomain.recover,
  [EXECUTE_WORKFLOW]: workflowDomain.execute,
  [WORKFLOW_STATUS]: workflowDomain.status,
  [WORKFLOW_RESULT]: workflowDomain.result,
  [GET_HOT_CACHE]: memoryDomain.getHotCache,
  [GET_FULL_HISTORY]: memoryDomain.getFullHistory
}, {
  middleware: [
    loggingMiddleware, 
    metricsMiddleware, 
    createMiddleware(validationMiddleware, {
      schemas: {
        [PING]: {
          required: false,
          properties: {}
        },
        [EXECUTE_WORKFLOW]: {
          required: true,
          properties: {
            workflowId: { type: 'string', required: true },
            steps: { type: 'array', required: true },
            synthesis: { type: 'object', required: false },
            options: { type: 'object', required: false }
          }
        },
        [BROADCAST_PROMPT]: {
          required: true,
          properties: {
            providerKey: { type: 'string', required: true },
            prompt: { type: 'string', required: true }
          }
        },
        [HARVEST_RESPONSE]: {
          required: true,
          properties: {
            payload: {
              type: 'object',
              required: true,
              properties: {
                providerKey: { type: 'string', required: true }
              }
            }
          }
        },
        [EXECUTE_PROMPT]: {
          required: true,
          properties: {
            providerKey: { type: 'string', required: true },
            prompt: { type: 'string', required: true },
            options: { type: 'object', required: false }
          }
        }
      },
      strictMode: true
    })
  ],
  errorHandler: handleError
});

// --- Message Listener ---

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  // Make the listener function async
  (async () => {
    console.log(`[Service Worker] Received message: ${message.type}. Waiting for TabManager...`);
    // This is the critical fix: wait for the initial tab scan to complete.
    await tabManager.ready;
    console.log(`[Service Worker] TabManager is ready. Routing message: ${message.type}`);
    
    // Use the router function directly - it handles sendResponse internally
    router(message, sender, sendResponse);
  })();
  
  return true; // Keep the message channel open for async response
});

console.log('[Service Worker] Initialized with new router architecture');