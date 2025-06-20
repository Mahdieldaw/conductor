import React, { useState, useEffect, useCallback } from 'react';
import { sidecarService } from '../services/SidecarService';
import type { Provider, PromptState, ProviderConfig, ResponseState } from '../types';

import { PromptTemplateBar } from './PromptTemplateBar';
import { PromptComposer } from './PromptComposer';
import { ProviderSelector } from './ProviderSelector';
import { ExecutionController } from './ExecutionController';
import { ResultsDisplay } from './ResultsDisplay';

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
  
  const [startNewChat, setStartNewChat] = useState(true);

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
    const targets = promptState.targetProviders;
    if (targets.length === 0) return;

    updatePromptState({ status: 'executing', responses: new Map() });

    // *** NEW LOGIC: RESET SESSIONS IF REQUIRED ***
    if (startNewChat) {
      console.log('Starting new chats for all target providers...');
      const resetPromises = targets.map(providerId => 
        sidecarService.resetSession(providerId).catch(err => ({
          providerId,
          status: 'error',
          error: err.message
        }))
      );
      // We can optionally handle errors from reset here, but for now we proceed.
      await Promise.allSettled(resetPromises);
      console.log('All targeted providers have been instructed to start a new chat.');
    }
    // *** END OF NEW LOGIC ***

    // Initialize UI state for all targets to 'pending'.
    const initialResponses = new Map(
      targets.map(id => [id, { status: 'pending' } as ResponseState])
    );
    updatePromptState({ responses: initialResponses });
  
    // Create an array of execution promises.
    const executionPromises = targets.map(providerId =>
      sidecarService.executePrompt(providerId, promptState.text)
        .then(value => ({ status: 'fulfilled', value, providerId }))
        .catch(reason => ({ status: 'rejected', reason, providerId }))
    );
  
    // Reconcile results one by one as they complete for better real-time feedback
    for (const promise of executionPromises) {
      const result = await promise;
      setPromptState(prev => {
        const newResponses = new Map(prev.responses);
        if ('value' in result) {
          newResponses.set(result.providerId, { status: 'completed', data: result.value });
        } else if ('reason' in result) {
          newResponses.set(result.providerId, { status: 'error', error: result.reason?.message || String(result.reason) });
        }
        return { ...prev, responses: newResponses };
      });
    }

    updatePromptState({ status: 'completed' });

  }, [promptState.targetProviders, promptState.text, startNewChat]);

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
              
              <div className="flex items-center gap-2 pl-1">
                <input
                  type="checkbox"
                  id="start-new-chat-toggle"
                  checked={startNewChat}
                  onChange={(e) => setStartNewChat(e.target.checked)}
                  disabled={isExecuting}
                  className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-indigo-500 focus:ring-indigo-600 cursor-pointer disabled:cursor-not-allowed"
                />
                <label
                  htmlFor="start-new-chat-toggle"
                  className={`text-sm ${isExecuting ? 'text-slate-500' : 'text-slate-300 cursor-pointer'}`}
                >
                  Start a new chat for each provider (clears context)
                </label>
              </div>

              <div className="h-[1px] bg-white/10 w-full"></div>

              <ExecutionController
                promptState={promptState}
                onExecute={handlePromptExecution}
                onClear={handleClear}
                onEdit={handleEdit}
                onRetry={handleRetry}
                onAddProvider={fetchAndUpdateProviderStatus}
              />
            </div>
            
            {promptState.responses.size > 0 && (
              <ResultsDisplay
                responses={promptState.responses}
                providers={providers}
              />
            )}
        </div>
    </div>
  );
};
