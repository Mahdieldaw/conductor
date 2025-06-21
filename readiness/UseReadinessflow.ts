import { useState, useCallback, useRef } from 'react';
import { sidecarService } from '../services/SidecarService';
import { getProviderConfig, PROVIDER_CONFIGS } from '../config/providers'; // Assuming you have a config file
import type { Provider, ReadinessCheckResult } from '../types';
import { normalizeStatus, getStatusDisplay } from '../utils/readinessUtils';

export const useReadinessFlow = () => {
  // Use a ref to track initialization to prevent multiple initial checks.
  const isInitializedRef = useRef(false);
  
  // State for all providers. Starts with a 'checking' status.
  const [providers, setProviders] = useState<Provider[]>(
    PROVIDER_CONFIGS.map(p => ({ 
      ...p, 
      status: 'checking', 
      statusMessage: 'Initializing...',
      isCheckInProgress: true,
    }))
  );

  // State to track if a global "check all" operation is running.
  // Addresses: Hook Return Interface
  const [globalCheckInProgress, setGlobalCheckInProgress] = useState(false);

  // Helper to safely update a single provider's state.
  const updateProviderState = useCallback((id: string, updates: Partial<Provider>) => {
    setProviders(prev =>
      prev.map(p => (p.id === id ? { ...p, ...updates } : p))
    );
  }, []);

  // The core function to check a single provider's status.
  const checkProvider = useCallback(async (id: string) => {
    // Prevent multiple checks for the same provider from running concurrently.
    const currentProvider = providers.find(p => p.id === id);
    if (currentProvider?.isCheckInProgress) {
      return currentProvider.status;
    }

    updateProviderState(id, { isCheckInProgress: true, status: 'checking' });
    
    try {
      const result: ReadinessCheckResult = await sidecarService.checkReadiness(id);
      const normalized = normalizeStatus(result.status);
      
      updateProviderState(id, {
        status: normalized,
        statusMessage: result.message,
        url: result.data?.url || getProviderConfig(id)?.url,
        isCheckInProgress: false,
        lastChecked: new Date(),
      });
      return normalized;
    } catch (error: any) {
      // Addresses: Error Boundaries (for single checks)
      console.error(`Readiness check failed for ${id}:`, error);
      updateProviderState(id, {
        status: 'service_error',
        statusMessage: error.message || 'An unknown error occurred.',
        isCheckInProgress: false,
        lastChecked: new Date(),
      });
      return 'service_error';
    }
  }, [providers, updateProviderState]); // Depends on providers to get current check status

  // Function to check all providers, ensuring it only runs once at a time.
  const checkAllProviders = useCallback(async () => {
    // Addresses: Race Condition (prevents a new global check if one is running)
    if (globalCheckInProgress) return;
    
    setGlobalCheckInProgress(true);
    
    // Use Promise.allSettled to ensure all checks complete, even if some fail.
    // Addresses: Error Boundaries (for the global check)
    await Promise.allSettled(
      PROVIDER_CONFIGS.map(p => checkProvider(p.id))
    );
    
    // Mark as initialized after the very first global check completes.
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
    }
    setGlobalCheckInProgress(false);
  }, [checkProvider, globalCheckInProgress]);

  // Function to handle the "fix" action for a provider.
  const fixProvider = useCallback((id: string) => {
    const provider = providers.find(p => p.id === id);
    if (!provider || provider.isCheckInProgress) return;

    if (provider.status === 'tab_not_open' && provider.url) {
      window.open(provider.url, '_blank');
      // Re-check after a delay to allow the tab to open.
      setTimeout(() => checkProvider(id), 3000);
    } else if (['login_required', 'service_error', 'network_error', 'timeout_error', 'offline'].includes(provider.status)) {
        // For any actionable error, the "fix" is to simply re-run the check.
        checkProvider(id);
    }
  }, [providers, checkProvider]);
  
  // Memoized function to get the list of ready providers.
  const readyProviders = useCallback(() => {
    return providers.filter(p => p.status === 'ready');
  }, [providers]);

  // Memoized value to quickly see if any provider needs user action.
  const hasProvidersNeedingAttention = useCallback(() => {
    return providers.some(p => getStatusDisplay(p.status).isActionable);
  }, [providers])(); // Immediately invoke to get the boolean value

  // Final return interface for the hook.
  // Addresses: Hook Return Interface
  return { 
    providers, 
    isInitialized: isInitializedRef.current, // Return the current value of the ref
    globalCheckInProgress,
    checkProvider, 
    checkAllProviders, 
    fixProvider,
    readyProviders,
    hasProvidersNeedingAttention,
  };
};