import React, { useState, useEffect, useCallback } from 'react';
import { sidecarService } from '../services/SidecarService';
import type { Provider, PromptState, ProviderConfig, ResponseState } from '../types';

import { PromptTemplateBar } from './PromptTemplateBar';
import { PromptComposer } from './PromptComposer';
import { ProviderSelector } from './ProviderSelector';
import { ExecutionController } from './ExecutionController';
import { ResponseStateManager } from './ResponseStatusManager';

// Static configuration of all potential providers the app knows about.
const PROVIDER_CONFIGS: ProviderConfig[] = [
  { id: 'chatgpt', name: 'ChatGPT', logoColor: '#10A37F' },
  { id: 'claude', name: 'Claude', logoColor: '#D97706' },
  { id: 'perplexity', name: 'Perplexity', logoColor: '#6B7280' },
  { id: 'gemini', name: 'Gemini', logoColor: '#4F46E5' },
];

export const PromptCanvas: React.FC = () => {
  const [promptState, setPromptState] = useState<PromptState>({
    text: "",
    targetProviders: [],
    status: "composing",
    responses: new Map(),
  });
  
  // This state holds the list of providers and their *live* status.
  const [providers, setProviders] = useState<Provider[]>([]);
  const isExecuting = promptState.status === 'executing';

  const updatePromptState = (updates: Partial<PromptState>) => {
    setPromptState(prev => ({ ...prev, ...updates }));
  };

  const fetchAndUpdateProviderStatus = useCallback(async () => {
    try {
      const liveTabs = await sidecarService.getAvailableTabs();
      const liveProviderKeys = liveTabs.map(tab => tab.platformKey);
      
      const newProviders: Provider[] = PROVIDER_CONFIGS.map(p => ({
        ...p,
        status: liveProviderKeys.includes(p.id) ? 'ready' as const : 'offline' as const,
      }));
      setProviders(newProviders);

      // Auto-select ready providers by default if none are selected
      if (promptState.targetProviders.length === 0) {
        const readyProviderIds = newProviders.filter(p => p.status === 'ready').map(p => p.id);
        updatePromptState({ targetProviders: readyProviderIds });
      }
    } catch (error) {
      console.error("Failed to fetch available providers:", error);
      // Here you could add UI to show this error to the user
    }
  }, [promptState.targetProviders.length]);

  // Fetch provider status on mount and set an interval to check periodically
  useEffect(() => {
    fetchAndUpdateProviderStatus();
    const interval = setInterval(fetchAndUpdateProviderStatus, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [fetchAndUpdateProviderStatus]);

  const handleClear = () => {
    setPromptState({
      text: "",
      targetProviders: [],
      status: "composing",
      responses: new Map()
    });
    fetchAndUpdateProviderStatus();
  };
  
  const handlePromptExecution = useCallback(async () => {
    const stateToExecute = { ...promptState };
    updatePromptState({ 
        status: 'executing', 
        responses: new Map(stateToExecute.targetProviders.map(p => [p, { status: 'pending' }]))
    });

    const executionPromises = stateToExecute.targetProviders.map(async (providerId) => {
      try {
        const responseData = await sidecarService.executePrompt(providerId, stateToExecute.text);
        setPromptState(prev => {
            const newResponses = new Map(prev.responses);
            newResponses.set(providerId, { status: 'completed', data: responseData });
            return { ...prev, responses: newResponses };
        });
      } catch (error) {
        console.error(`Error executing on ${providerId}:`, error);
        setPromptState(prev => {
            const newResponses = new Map(prev.responses);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            newResponses.set(providerId, { status: 'error', error: errorMessage });
            return { ...prev, responses: newResponses };
        });
      }
    });

    await Promise.allSettled(executionPromises);
    updatePromptState({ status: 'completed' });
  }, [promptState]);

  const handleInsertTemplate = (templateText: string) => {
    updatePromptState({
        text: promptState.text ? `${promptState.text.trim()}\n\n${templateText}` : templateText
    });
    document.getElementById('prompt-input')?.focus();
  };
  
  const handleEdit = () => {
      updatePromptState({ status: 'composing', responses: new Map() });
  };
  
  const handleRetry = () => {
      const failedProviders = Array.from(promptState.responses.entries())
                                  .filter(([, resp]) => resp.status === 'error')
                                  .map(([id]) => id);
      if (failedProviders.length > 0) {
          setPromptState(prev => ({ ...prev, targetProviders: failedProviders }));
          handlePromptExecution();
      }
  };

  return (
    <div className="bg-slate-900 min-h-screen p-4 sm:p-8 flex justify-center font-sans">
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-4">
            <div className="bg-gradient-to-br from-slate-800/50 via-slate-900 to-black p-6 rounded-2xl shadow-2xl shadow-black/50 border border-slate-700 flex flex-col gap-5">
              <div>
                  <PromptTemplateBar onInsert={handleInsertTemplate} disabled={isExecuting} />
                  <PromptComposer
                      value={promptState.text}
                      onChange={(text) => updatePromptState({ text })}
                      disabled={isExecuting}
                  />
              </div>

              <ProviderSelector
                available={providers}
                selected={promptState.targetProviders}
                onSelectionChange={(selected) => updatePromptState({ targetProviders: selected })}
                disabled={isExecuting}
              />
              
              <div className="h-[1px] bg-white/10 w-full"></div>

              <ExecutionController
                promptState={promptState}
                onExecute={handlePromptExecution}
                onClear={handleClear}
                onEdit={handleEdit}
                onRetry={handleRetry}
                onAddProvider={fetchAndUpdateProviderStatus} // Re-scan for providers
              />
            </div>
            
            {promptState.responses.size > 0 && (
              <ResponseStateManager
                responses={promptState.responses}
                providers={providers}
              />
            )}
        </div>
    </div>
  );
};
