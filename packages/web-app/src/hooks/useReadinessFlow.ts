import { useState, useCallback, useRef, useEffect } from 'react';
import { sidecarService } from '../services/SidecarService';
import { getProviderConfig, PROVIDER_CONFIGS } from '../config/providers';
import type { Provider, ReadinessCheckResult } from '../types';
import { normalizeStatus, getStatusDisplay } from '../utils/readinessUtils';

export const useReadinessFlow = () => {
  const isInitializedRef = useRef(false);
  const [providers, setProviders] = useState<Provider[]>(
    PROVIDER_CONFIGS.map(p => ({ 
      ...p, 
      status: 'checking', 
      statusMessage: 'Initializing...',
      isCheckInProgress: true,
    }))
  );
  
  const checkInProgressRef = useRef(false);
  const [globalCheckInProgress, setGlobalCheckInProgress] = useState(false);
  
  const providersRef = useRef(providers);
  useEffect(() => { providersRef.current = providers; }, [providers]);

  const updateProviderState = useCallback((id: string, upd: Partial<Provider>) => {
    setProviders(prev =>
      prev.map(p => (p.id === id ? { ...p, ...upd } : p))
    );
  }, []);

  const checkProvider = useCallback(async (id: string) => {
    updateProviderState(id, { isCheckInProgress: true, status: 'checking' });

    try {
      const res: ReadinessCheckResult = await sidecarService.checkReadiness(id);
      const status = normalizeStatus(res.status);
      updateProviderState(id, {
        status,
        statusMessage: res.message,
        url: res.data?.url || getProviderConfig(id)?.url,
        isCheckInProgress: false,
        lastChecked: new Date(),
      });
      return status;
    } catch (err: any) {
      console.error(`Readiness check failed for ${id}:`, err);
      updateProviderState(id, {
        status: 'service_error',
        statusMessage: err.message || 'Unknown error',
        isCheckInProgress: false,
        lastChecked: new Date(),
      });
      return 'service_error';
    }
  }, [updateProviderState]);

  const checkAllProviders = useCallback(async () => {
    if (checkInProgressRef.current) return;

    checkInProgressRef.current = true;
    setGlobalCheckInProgress(true);

    await Promise.allSettled(
      PROVIDER_CONFIGS.map(p => checkProvider(p.id))
    );
    
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
    }

    checkInProgressRef.current = false;
    setGlobalCheckInProgress(false);
  }, [checkProvider]);

  const fixProvider = useCallback((id: string) => {
    const cur = providersRef.current.find(p => p.id === id);
    if (!cur || cur.isCheckInProgress) return;
    if (cur.status === 'tab_not_open' && cur.url) {
      window.open(cur.url, '_blank');
      setTimeout(() => checkProvider(id), 3000);
    } else if (['login_required','service_error','network_error','timeout_error','offline'].includes(cur.status)) {
      checkProvider(id);
    }
  }, [checkProvider]);

  const readyProviders = useCallback(
    () => providers.filter(p => p.status === 'ready'),
    [providers]
  );
  const hasProvidersNeedingAttention = useCallback(
    () => providers.some(p => getStatusDisplay(p.status).isActionable),
    [providers]
  )();

  return {
    providers,
    isInitialized: isInitializedRef.current,
    globalCheckInProgress,
    checkProvider,
    checkAllProviders,
    fixProvider,
    readyProviders,
    hasProvidersNeedingAttention,
  };
};
