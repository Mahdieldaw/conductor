// FlightManager - Phase 2 Implementation
// Manages transient execution states and tracks "flights" from prompt to response

import { tabPool } from './tab-pool.js';

// Flight states
const FLIGHT_STATES = {
  LAUNCHING: 'LAUNCHING',
  IN_FLIGHT: 'IN_FLIGHT',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
};

class FlightManager {
  constructor() {
    this.flights = new Map(); // flightId -> flight object
    this.flightCounter = 0;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    console.log('[FlightManager] Initializing flight manager');
    
    this.isInitialized = true;
    console.log('[FlightManager] Flight manager initialized');
  }

  /**
   * Launch a new flight (prompt execution)
   * Returns a flight object with tracking information
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
   * Complete a flight with result
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
   * Fail a flight with error
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
   * Cancel a flight
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
   * Retry a failed flight
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
   * Get flight by ID
   */
  getFlight(flightId) {
    return this.flights.get(flightId);
  }

  /**
   * Get all flights for a provider
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
   * Get flights by state
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
   * Update flight state and metadata
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
   * Generate unique flight ID
   */
  generateFlightId() {
    return `flight_${++this.flightCounter}_${Date.now()}`;
  }

  /**
   * Cleanup completed/failed flights
   */
  cleanupFlight(flightId) {
    const flight = this.flights.get(flightId);
    if (flight) {
      console.log(`[FlightManager] Cleaning up flight ${flightId}`);
      this.flights.delete(flightId);
    }
  }

  /**
   * Cleanup old flights (called periodically)
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
   * Get flight statistics
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