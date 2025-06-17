import React, { useState, useEffect, useCallback } from 'react';
import { BrainCircuit, Check, X, Send, RotateCw, Pencil, Loader, Plus, ArrowRightLeft, PenSquare, Share2, Rss } from 'lucide-react';
import { sidecarService } from '../services/SidecarService';

// This is now static config, the `status` will be updated dynamically
const AVAILABLE_PROVIDERS = [
  { id: 'chatgpt', name: 'ChatGPT', logoColor: '#10A37F' },
  { id: 'claude', name: 'Claude', logoColor: '#D97706' },
  // Add other potential providers here
  { id: 'perplexity', name: 'Perplexity', logoColor: '#6B7280' },
  { id: 'gemini', name: 'Gemini', logoColor: '#4F46E5' },
];

const PROMPT_TEMPLATES = [
  { id: "compare", label: "Compare & Contrast", icon: ArrowRightLeft, text: "Compare and contrast...\n\n" },
  { id: "structure", label: "Structure This", icon: PenSquare, text: "Improve the following text...\n\n" },
  { id: "synthesize", label: "Synthesize", icon: Share2, text: "Synthesize the following information...\n\n" },
  { id: "enhance", label: "Enhance Draft", icon: Rss, text: "Enhance the following draft...\n\n" },
];

// --- Helper Components (Can be split into their own files later) ---

const ProviderChip = ({ provider, selected, onClick, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled || provider.status === 'offline'}
      className={`flex items-center justify-between gap-2 px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200 ${selected ? `bg-white/10 border-[${provider.logoColor}] text-white ring-2 ring-[${provider.logoColor}]` : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'} ${(disabled || provider.status === 'offline') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${provider.status === 'ready' ? 'bg-green-500' : 'bg-gray-500'}`}></span>
        <span>{provider.name}</span>
      </div>
      {selected && <Check size={16} className="text-green-400" />}
    </button>
);
// ... (All other small helper components like PrimaryButton, QuickActionButton etc. would go here)
// For brevity, I will assume they are defined as in the initial prototype

// --- Core Logic ---

export const PromptCanvas = () => {
  const [promptState, setPromptState] = useState({
    text: "",
    targetProviders: [],
    status: "composing", // composing | executing | completed
    responses: new Map(),
  });
  
  const [providerStatus, setProviderStatus] = useState([]);

  const isExecuting = promptState.status === 'executing';

  // Fetch available tabs from the sidecar when the component mounts
  useEffect(() => {
    const updateAvailableProviders = async () => {
      try {
        const liveTabs = await sidecarService.getAvailableTabs();
        const liveProviderKeys = liveTabs.map(tab => tab.platformKey);
        
        const statuses = AVAILABLE_PROVIDERS.map(p => ({
          ...p,
          status: liveProviderKeys.includes(p.id) ? 'ready' : 'offline',
        }));
        setProviderStatus(statuses);

        // Auto-select ready providers
        const readyProviderIds = statuses.filter(p => p.status === 'ready').map(p => p.id);
        updatePromptState({ targetProviders: readyProviderIds });
      } catch (error) {
        console.error("Failed to fetch available providers:", error);
        // Handle error display in UI
      }
    };
    updateAvailableProviders();
  }, []);

  const updatePromptState = (updates) => {
    setPromptState(prev => ({ ...prev, ...updates }));
  };

  const handleClear = () => {
      // Logic to clear the state
  };
  
  // REAL EXECUTION LOGIC
  const handlePromptExecution = useCallback(async (currentPromptState) => {
    updatePromptState({ status: 'executing', responses: new Map() });

    const executionPromises = currentPromptState.targetProviders.map(async (providerId) => {
      updatePromptState({
          responses: new Map(promptState.responses).set(providerId, { status: 'pending' })
      });
      try {
        const responseData = await sidecarService.executePrompt(providerId, currentPromptState.text);
        setPromptState(prev => {
            const newResponses = new Map(prev.responses);
            newResponses.set(providerId, { status: 'completed', data: responseData });
            return { ...prev, responses: newResponses };
        });
      } catch (error) {
        console.error(`Error executing on ${providerId}:`, error);
        setPromptState(prev => {
            const newResponses = new Map(prev.responses);
            newResponses.set(providerId, { status: 'error', error: error.message });
            return { ...prev, responses: newResponses };
        });
      }
    });

    await Promise.allSettled(executionPromises);
    updatePromptState({ status: 'completed' });
  }, [promptState.responses]);


  const handleInsertTemplate = (templateText) => {
    // Logic to insert template
  };
  
  // The rest of the handlers (handleRetry, handleEdit) would also be re-wired here

  return (
    <div className="bg-slate-900 min-h-screen p-4 sm:p-8 flex items-center justify-center font-sans">
        <div className="w-full max-w-3xl mx-auto">
            {/* The rest of the JSX for PromptCanvas, similar to the prototype */}
            {/* It will use `providerStatus` instead of `AVAILABLE_PROVIDERS` to render the chips */}
            <div className="bg-gradient-to-br from-slate-800/50 via-slate-900 to-black p-6 rounded-2xl shadow-2xl shadow-black/50 border border-slate-700 flex flex-col gap-5">
              {/* All the child components go here */}
              <h2 className="text-xl font-semibold text-white">Hybrid Thinking Control Panel</h2>
              {/* For brevity, not including all the JSX but this is where it goes */}
            </div>
        </div>
    </div>
  );
};
