// FlightManager - Phase 2 Implementation
// Manages transient execution states and tracks "flights" from prompt to response

import { tabPool } from './tabPool.js';
import { activateTabIfConfigured } from './tabActivator.js';
import { configManager } from './configManager.js';

// Flight states
const FLIGHT_STATES = {
  LAUNCHING: 'LAUNCHING',
  IN_FLIGHT: 'IN_FLIGHT',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
};

/**
 * Manages the lifecycle of asynchronous operations, referred to as "flights".
 * A flight represents a single, trackable execution from a prompt to its eventual response,
 * including all intermediate states, retries, and potential failures.
 */
class FlightManager {
  constructor() {
    this.flights = new Map(); // flightId -> flight object
    this.flightCounter = 0;
    this.isInitialized = false;
  }

  /**
   * Initializes the FlightManager.
   * This method should be called once before any other methods are used.
   */
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('[FlightManager] Initializing flight manager');
    
    this.isInitialized = true;
    console.log('[FlightManager] Flight manager initialized');
  }

  /**
   * Launches a new flight for a given provider and prompt.
   *
   * @param {string} providerKey - The key identifying the provider (e.g., 'chatgpt', 'claude').
   * @param {object} prompt - The prompt object to be sent to the provider.
   * @param {object} [options={}] - Optional parameters for the flight.
   * @param {number} [options.timeout=30000] - The timeout for the flight in milliseconds.
   * @param {number} [options.retries=0] - The number of times the flight has been retried.
   * @param {number} [options.maxRetries=2] - The maximum number of retries allowed.
   * @param {object} [options.metadata] - Additional metadata to be stored with the flight.
   * @returns {Promise<object>} A promise that resolves with the flight object.
   */
  async launchFlight(providerKey, prompt, options = {}) {
    const flightId = this.generateFlightId();
    
    console.log(`[FlightManager] Launching flight ${flightId} for provider: ${providerKey}`);
    
    // Create flight object
    const flight = {
      flightId,
      providerKey,
      prompt,
      state: FLIGHT_STATES.LAUNCHING,
      tabId: null,
      startTime: Date.now(),
      endTime: null,
      result: null,
      error: null,
      metadata: {
        timeout: options.timeout || 30000,
        retries: options.retries || 0,
        maxRetries: options.maxRetries || 2,
        ...options.metadata
      }
    };
    
    // Store flight
    this.flights.set(flightId, flight);
    
    try {
      // Acquire worker tab
      const tab = await tabPool.getWorkerTab(providerKey);
      flight.tabId = tab.tabId;

      // Activate tab if configured
      const config = await configManager.getConfig(providerKey);
      await activateTabIfConfigured(tab.tabId, config, 'broadcast');
      
      // Update state to in-flight
      this.updateFlightState(flightId, FLIGHT_STATES.IN_FLIGHT);
      
      console.log(`[FlightManager] Flight ${flightId} launched on tab ${tab.tabId}`);
      
      return flight;
    } catch (error) {
      console.error(`[FlightManager] Failed to launch flight ${flightId}:`, error);
      
      // Mark flight as failed
      this.updateFlightState(flightId, FLIGHT_STATES.FAILED, null, error);
      
      throw error;
    }
  }

  /**
   * Marks a flight as completed successfully.
   *
   * @param {string} flightId - The ID of the flight to complete.
   * @param {*} result - The result of the flight.
   * @returns {boolean} True if the flight was found and completed, false otherwise.
   */
  completeFlight(flightId, result) {
    const flight = this.flights.get(flightId);
    if (!flight) {
      console.warn(`[FlightManager] Attempted to complete unknown flight: ${flightId}`);
      return false;
    }
    
    console.log(`[FlightManager] Completing flight ${flightId}`);
    
    // Update flight with result
    this.updateFlightState(flightId, FLIGHT_STATES.COMPLETED, result);
    
    // Release the tab back to pool
    if (flight.tabId) {
      tabPool.releaseTab(flight.tabId);
    }
    
    // Schedule cleanup
    setTimeout(() => this.cleanupFlight(flightId), 60000); // Keep for 1 minute
    
    return true;
  }

  /**
   * Marks a flight as failed.
   * If the flight has not exceeded its maximum number of retries, it will be retried.
   *
   * @param {string} flightId - The ID of the flight to fail.
   * @param {Error} error - The error that caused the flight to fail.
   * @returns {boolean} True if the flight is scheduled for a retry, false if it has permanently failed.
   */
  failFlight(flightId, error) {
    const flight = this.flights.get(flightId);
    if (!flight) {
      console.warn(`[FlightManager] Attempted to fail unknown flight: ${flightId}`);
      return false;
    }
    
    console.error(`[FlightManager] Flight ${flightId} failed:`, error);
    
    // Check if we should retry
    if (flight.metadata.retries < flight.metadata.maxRetries) {
      console.log(`[FlightManager] Retrying flight ${flightId} (attempt ${flight.metadata.retries + 1})`);
      
      // Increment retry counter
      flight.metadata.retries++;
      
      // Release current tab if any
      if (flight.tabId) {
        tabPool.markTabError(flight.tabId, error);
        flight.tabId = null;
      }
      
      // Reset to launching state for retry
      this.updateFlightState(flightId, FLIGHT_STATES.LAUNCHING);
      
      // Retry after a delay
      setTimeout(() => this.retryFlight(flightId), 2000);
      
      return true;
    }
    
    // No more retries, mark as failed
    this.updateFlightState(flightId, FLIGHT_STATES.FAILED, null, error);
    
    // Release the tab back to pool or mark as error
    if (flight.tabId) {
      tabPool.markTabError(flight.tabId, error);
    }
    
    // Schedule cleanup
    setTimeout(() => this.cleanupFlight(flightId), 60000);
    
    return false;
  }

  /**
   * Cancels an in-progress flight.
   *
   * @param {string} flightId - The ID of the flight to cancel.
   * @param {string} [reason='User cancelled'] - The reason for the cancellation.
   * @returns {boolean} True if the flight was found and cancelled, false otherwise.
   */
  cancelFlight(flightId, reason = 'User cancelled') {
    const flight = this.flights.get(flightId);
    if (!flight) {
      console.warn(`[FlightManager] Attempted to cancel unknown flight: ${flightId}`);
      return false;
    }
    
    console.log(`[FlightManager] Cancelling flight ${flightId}: ${reason}`);
    
    // Update state
    this.updateFlightState(flightId, FLIGHT_STATES.CANCELLED, null, new Error(reason));
    
    // Release the tab back to pool
    if (flight.tabId) {
      tabPool.releaseTab(flight.tabId);
    }
    
    // Schedule cleanup
    setTimeout(() => this.cleanupFlight(flightId), 10000);
    
    return true;
  }

  /**
   * Retries a flight that has previously failed.
   *
   * @param {string} flightId - The ID of the flight to retry.
   * @returns {Promise<boolean>} A promise that resolves with true if the retry was successful, false otherwise.
   */
  async retryFlight(flightId) {
    const flight = this.flights.get(flightId);
    if (!flight || flight.state !== FLIGHT_STATES.LAUNCHING) {
      console.warn(`[FlightManager] Cannot retry flight ${flightId} in state: ${flight?.state}`);
      return false;
    }
    
    try {
      console.log(`[FlightManager] Retrying flight ${flightId}`);
      
      // Acquire new worker tab
      const tab = await tabPool.getWorkerTab(flight.providerKey);
      flight.tabId = tab.tabId;
      
      // Update state to in-flight
      this.updateFlightState(flightId, FLIGHT_STATES.IN_FLIGHT);
      
      return true;
    } catch (error) {
      console.error(`[FlightManager] Retry failed for flight ${flightId}:`, error);
      
      // Mark as failed if retry fails
      this.updateFlightState(flightId, FLIGHT_STATES.FAILED, null, error);
      
      return false;
    }
  }

  /**
   * Retrieves a flight by its ID.
   *
   * @param {string} flightId - The ID of the flight to retrieve.
   * @returns {object|undefined} The flight object, or undefined if not found.
   */
  getFlight(flightId) {
    return this.flights.get(flightId);
  }

  /**
   * Retrieves all flights for a given provider.
   *
   * @param {string} providerKey - The key of the provider.
   * @returns {object[]} An array of flight objects.
   */
  getFlightsByProvider(providerKey) {
    const flights = [];
    for (const flight of this.flights.values()) {
      if (flight.providerKey === providerKey) {
        flights.push(flight);
      }
    }
    return flights;
  }

  /**
   * Retrieves all flights in a given state.
   *
   * @param {string} state - The state to filter by (e.g., 'IN_FLIGHT').
   * @returns {object[]} An array of flight objects.
   */
  getFlightsByState(state) {
    const flights = [];
    for (const flight of this.flights.values()) {
      if (flight.state === state) {
        flights.push(flight);
      }
    }
    return flights;
  }

  /**
   * Updates the state and associated data of a flight.
   *
   * @param {string} flightId - The ID of the flight to update.
   * @param {string} newState - The new state for the flight.
   * @param {*} [result=null] - The result to store if the flight is completed.
   * @param {Error} [error=null] - The error to store if the flight has failed.
   * @returns {boolean} True if the flight was found and updated, false otherwise.
   * @private
   */
  updateFlightState(flightId, newState, result = null, error = null) {
    const flight = this.flights.get(flightId);
    if (!flight) {
      console.warn(`[FlightManager] Cannot update unknown flight: ${flightId}`);
      return false;
    }
    
    const oldState = flight.state;
    flight.state = newState;
    
    if (result !== null) {
      flight.result = result;
    }
    
    if (error !== null) {
      flight.error = error;
    }
    
    // Set end time for terminal states
    if ([FLIGHT_STATES.COMPLETED, FLIGHT_STATES.FAILED, FLIGHT_STATES.CANCELLED].includes(newState)) {
      flight.endTime = Date.now();
    }
    
    console.log(`[FlightManager] Flight ${flightId} state: ${oldState} -> ${newState}`);
    
    return true;
  }

  /**
   * Generates a unique ID for a new flight.
   *
   * @returns {string} A unique flight ID.
   * @private
   */
  generateFlightId() {
    return `flight_${++this.flightCounter}_${Date.now()}`;
  }

  /**
   * Removes a flight from the manager's tracking.
   *
   * @param {string} flightId - The ID of the flight to remove.
   * @private
   */
  cleanupFlight(flightId) {
    const flight = this.flights.get(flightId);
    if (flight) {
      console.log(`[FlightManager] Cleaning up flight ${flightId}`);
      this.flights.delete(flightId);
    }
  }

  /**
   * Periodically cleans up old or stuck flights to prevent memory leaks.
   *
   * @param {number} [maxAge=300000] - The maximum age of a completed or stuck flight in milliseconds.
   */
  cleanupOldFlights(maxAge = 300000) { // 5 minutes
    const now = Date.now();
    const toCleanup = [];
    
    for (const [flightId, flight] of this.flights.entries()) {
      // Clean up terminal flights older than maxAge
      if (flight.endTime && (now - flight.endTime) > maxAge) {
        toCleanup.push(flightId);
      }
      // Clean up stuck flights older than maxAge
      else if (!flight.endTime && (now - flight.startTime) > maxAge) {
        console.warn(`[FlightManager] Cleaning up stuck flight ${flightId}`);
        toCleanup.push(flightId);
      }
    }
    
    for (const flightId of toCleanup) {
      this.cleanupFlight(flightId);
    }
    
    if (toCleanup.length > 0) {
      console.log(`[FlightManager] Cleaned up ${toCleanup.length} old flights`);
    }
  }

  /**
   * Retrieves statistics about the current state of all flights.
   *
   * @returns {object} An object containing flight statistics.
   */
  getStats() {
    const stats = {
      total: this.flights.size,
      launching: 0,
      inFlight: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };
    
    for (const flight of this.flights.values()) {
      switch (flight.state) {
        case FLIGHT_STATES.LAUNCHING:
          stats.launching++;
          break;
        case FLIGHT_STATES.IN_FLIGHT:
          stats.inFlight++;
          break;
        case FLIGHT_STATES.COMPLETED:
          stats.completed++;
          break;
        case FLIGHT_STATES.FAILED:
          stats.failed++;
          break;
        case FLIGHT_STATES.CANCELLED:
          stats.cancelled++;
          break;
      }
    }
    
    return stats;
  }

  /**
   * Start periodic cleanup
   */
  startPeriodicCleanup() {
    // Clean up old flights every 2 minutes
    setInterval(() => {
      this.cleanupOldFlights();
    }, 120000);
    
    console.log('[FlightManager] Periodic cleanup started');
  }

  /**
   * Cleanup and shutdown
   */
  destroy() {
    // Cancel all active flights
    for (const [flightId, flight] of this.flights.entries()) {
      if ([FLIGHT_STATES.LAUNCHING, FLIGHT_STATES.IN_FLIGHT].includes(flight.state)) {
        this.cancelFlight(flightId, 'System shutdown');
      }
    }
    
    console.log('[FlightManager] Flight manager destroyed');
  }
}

// Export singleton instance
export const flightManager = new FlightManager();
export { FLIGHT_STATES };