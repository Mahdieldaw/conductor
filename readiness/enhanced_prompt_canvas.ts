// Enhanced PromptCanvas.tsx with production-grade readiness integration
import React, { useState, useEffect, useCallback } from 'react';
import { sidecarService } from '../services/SidecarService';
import { useReadinessFlow } from '../hooks/useReadinessFlow';
import type { PromptState, ResponseState } from '../types';

import { PromptTemplateBar } from './PromptTemplateBar';
import { PromptComposer } from './PromptComposer';
import { ProviderSelector } from './ProviderSelector';
import { ExecutionController } from './ExecutionController';
import { ResultsDisplay } from './ResultsDisplay';

export const PromptCanvas: React.FC = () => {
  const [promptState, setPromptState] = useState<PromptState>({
    text: "",
    targetProviders: [],
    status: "composing",
    responses: new Map(),
    manuallyDeselected: new Set(),
  });
  
  const [startNewChat, setStartNewChat] = useState(true);

  // Use the production-grade readiness hook
  const {
    providers,
    isInitialized,
    globalCheckInProgress,
    checkProvider,
    checkAllProviders,
    fixProvider,
    readyProviders,
    hasProvidersNeedingAttention,
  } = useReadinessFlow();

  const isExecuting = promptState.status === 'executing';

  const updatePromptState = useCallback((updates: Partial<PromptState>) => {
    setPromptState(prev => ({ ...prev, ...updates }));
  }, []);

  // Initialize readiness checks on component mount
  useEffect(() => {
    checkAllProviders().catch(error => {
      console.error('Initial provider check failed:', error);
    });

    // Optional: Set up periodic health checks (less frequent than before)
    const healthCheckInterval = setInterval(() => {
      // Only do periodic checks if not currently executing
      if (promptState.status !== 'executing') {
        checkAllProviders().catch(error => {
          console.error('Periodic provider check failed:', error);
        });
      }
    }, 30000); // Check every 30 seconds instead of 15

    return () => clearInterval(healthCheckInterval);
  }, [checkAllProviders, promptState.status]);

  // Auto-select ready providers, but respect manual deselections
  useEffect(() => {
    if (!isInitialized) return;

    const ready = readyProviders();
    const readyIds = ready.map(p => p.id);
    
    // Only auto-select if:
    // 1. No providers are currently selected, OR
    // 2. All currently selected providers are offline/error
    const currentlySelected = promptState.targetProviders;
    const hasValidSelections = currentlySelected.