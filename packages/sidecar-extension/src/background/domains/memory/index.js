/**
 * Memory Domain - Handles tiered memory management for workflow sessions
 * 
 * This domain provides access to both hot cache (recent sessions) and
 * cold storage (complete history) for workflow session data.
 */

export { getHotCache } from './hot-cache.js';
export { getFullHistory } from './full-history.js';