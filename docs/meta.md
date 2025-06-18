you'll need to copy the smaller helper components (like PrimaryButton, PromptComposer, etc.) from our original prototype into the src/components/ directory.import React, { useState, useEffect, useCallback } from 'react';



// Added some icons that might be used for the new template feature, kept existing ones
import { BrainCircuit, Check, X, Send, RotateCw, Pencil, Loader, Plus, Rss, ArrowRightLeft, PenSquare, Share2 } from 'lucide-react';

// --- MOCK DATA & CONFIG ---
const AVAILABLE_PROVIDERS = [
  { id: 'chatgpt', name: 'ChatGPT', logoColor: '#10A37F', status: 'ready' },
  { id: 'claude', name: 'Claude', logoColor: '#D97706', status: 'ready' },
  { id: 'perplexity', name: 'Perplexity', logoColor: '#6B7280', status: 'ready' },
  { id: 'gemini', name: 'Gemini', logoColor: '#4F46E5', status: 'offline' }
];

const PROMPT_TEMPLATES = [
    { id: "compare", label: "Compare & Contrast", icon: ArrowRightLeft, text: "Compare and contrast the following ideas or outputs, focusing on key similarities, differences, and unique insights:\n\n" },
    { id: "structure", label: "Structure This", icon: PenSquare, text: "Improve the following text by organizing it into a more structured format (e.g., using headings, bullet points, or tables). Identify the core message and present it with enhanced clarity:\n\n" },
    { id: "synthesize", label: "Synthesize", icon: Share2, text: "Synthesize the following information into a cohesive summary. Extract the most critical insights and present them as a unified narrative or a set of key takeaways:\n\n" },
    { id: "enhance", label: "Enhance Draft", icon: Rss, text: "Enhance the following draft for clarity, depth, and a more compelling tone. Identify weaknesses and suggest specific improvements:\n\n" },
];


// --- UTILITY FUNCTIONS ---
const generateId = () => `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// --- HELPER COMPONENTS ---

// A visually distinct chip for each AI provider (No changes)
const ProviderChip = ({ provider, selected, onClick, disabled }) => {
  const statusIndicatorColor = {
    ready: "bg-green-500",
    busy: "bg-yellow-500",
    error: "bg-red-500",
    offline: "bg-gray-500"
  }[provider.status] || "bg-gray-500";

  return (
    <button
      onClick={onClick}
      disabled={disabled || provider.status === 'offline'}
      className={`
        flex items-center justify-between gap-2 px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200
        ${selected
          ? `bg-white/10 border-[${provider.logoColor}] text-white ring-2 ring-[${provider.logoColor}]`
          : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
        }
        ${(disabled || provider.status === 'offline')
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer'
        }
      `}
    >
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${statusIndicatorColor}`}></span>
        <span>{provider.name}</span>
      </div>
      {selected && <Check size={16} className="text-green-400" />}
      {provider.status === 'offline' && <X size={16} className="text-red-400" />}
    </button>
  );
};

// Master toggle for all providers (No changes)
const AllToggle = ({ allSelected, onToggle, disabled }) => (
  <button
    onClick={onToggle}
    disabled={disabled}
    className={`
      px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200
      ${allSelected
        ? 'bg-indigo-600 border-indigo-500 text-white'
        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
      }
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    `}
  >
    All ✓
  </button>
);

// Primary action button (No changes)
const PrimaryButton = ({ onClick, disabled, children, icon: Icon }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="
      flex items-center justify-center gap-2 w-full sm:w-auto bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg 
      transition-all duration-200 ease-in-out
      hover:bg-indigo-500
      disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed
      focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-75
      shadow-lg shadow-indigo-900/40
    "
  >
    {Icon && <Icon size={18} />}
    {children}
  </button>
);

// Secondary action button (No changes)
const SecondaryButton = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="
      w-full sm:w-auto bg-transparent text-gray-400 font-medium py-3 px-6 rounded-lg
      transition-all duration-200 ease-in-out
      hover:bg-white/5 hover:text-white
    "
  >
    {children}
  </button>
);

// Quick action button (No changes)
const QuickActionButton = ({ onClick, children, icon: Icon }) => (
  <button
    onClick={onClick}
    className="
      flex items-center gap-2 text-sm bg-white/10 text-gray-300 px-3 py-1.5 rounded-md
      hover:bg-white/20 hover:text-white transition-colors duration-150
    "
  >
    {Icon && <Icon size={14} />}
    {children}
  </button>
);


// --- CORE COMPONENTS ---

// ✨ NEW: Component for prompt templates ✨
const PromptTemplateBar = ({ onInsert, disabled }) => (
  <div className="flex flex-wrap items-center gap-2 mb-3">
    {PROMPT_TEMPLATES.map(template => (
      <button
        key={template.id}
        onClick={() => onInsert(template.text)}
        disabled={disabled}
        className="
          flex items-center gap-2 text-sm bg-white/5 text-gray-300 px-3 py-1.5 rounded-md
          hover:bg-white/15 hover:text-white transition-colors duration-150
          disabled:opacity-50 disabled:cursor-not-allowed
        "
      >
        <template.icon size={14} />
        {template.label}
      </button>
    ))}
  </div>
);

// Prompt Composer - the main textarea (No changes)
const PromptComposer = ({ value, onChange, disabled }) => {
  useEffect(() => {
    const textarea = document.getElementById('prompt-input');
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

  return (
    <div className="relative w-full">
      <BrainCircuit size={20} className="absolute top-4 left-4 text-gray-500" />
      <textarea
        id="prompt-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="What do you want to think through? Select a template or start typing."
        className="
          w-full bg-black/30 text-gray-100 placeholder-gray-500 rounded-xl
          p-4 pl-12 resize-none border-2 border-transparent focus:border-indigo-500 focus:ring-0
          transition-colors duration-200 text-lg leading-relaxed
          min-h-[100px]
        "
        rows={3}
      />
    </div>
  );
};

// ProviderSelector (No changes)
const ProviderSelector = ({ available, selected, onSelectionChange, disabled }) => {
  const toggleProvider = (providerId) => {
    const newSelection = selected.includes(providerId)
      ? selected.filter(p => p !== providerId)
      : [...selected, providerId];
    onSelectionChange(newSelection);
  };

  const toggleAll = () => {
    const allAvailableIds = available.filter(p => p.status !== 'offline').map(p => p.id);
    onSelectionChange(selected.length === allAvailableIds.length ? [] : allAvailableIds);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {available.map(provider => (
        <ProviderChip
          key={provider.id}
          provider={provider}
          selected={selected.includes(provider.id)}
          onClick={() => toggleProvider(provider.id)}
          disabled={disabled}
        />
      ))}
      <div className="border-l border-white/10 h-6 mx-2"></div>
      <AllToggle
        allSelected={selected.length === available.filter(p => p.status !== 'offline').length && selected.length > 0}
        onToggle={toggleAll}
        disabled={disabled}
      />
    </div>
  );
};


// ExecutionController (No changes)
const ExecutionController = ({ promptState, onExecute, onClear, onEdit, onRetry, onAddProvider }) => {
  const isExecuting = promptState.status === 'executing';
  const hasFailedProviders = promptState.targetProviders.some(p => promptState.responses.get(p)?.status === 'error');

  if (promptState.status === 'composing') {
    return (
      <div className="flex flex-col sm:flex-row items-center gap-3 mt-4 w-full">
        <PrimaryButton
          onClick={() => onExecute(promptState)}
          disabled={!promptState.text.trim() || promptState.targetProviders.length === 0}
          icon={Send}
        >
          Send to {promptState.targetProviders.length} Selected
        </PrimaryButton>
        <SecondaryButton onClick={onClear}>Clear</SecondaryButton>
      </div>
    );
  }

  if (isExecuting) {
    return (
      <div className="flex items-center gap-3 text-lg font-semibold text-gray-300 mt-4 p-3 bg-white/5 rounded-lg">
        <Loader size={20} className="animate-spin text-indigo-400" />
        <span>Executing...</span>
      </div>
    );
  }

  // Post-execution actions
  return (
    <div className="flex flex-wrap items-center gap-3 mt-4 p-3 bg-white/5 rounded-lg">
      <span className="text-gray-300 font-medium mr-2">Next:</span>
      <QuickActionButton onClick={onEdit} icon={Pencil}>
        Edit & Re-send
      </QuickActionButton>
      {hasFailedProviders && (
         <QuickActionButton onClick={onRetry} icon={RotateCw}>
           Retry Failed
         </QuickActionButton>
      )}
       <QuickActionButton onClick={onAddProvider} icon={Plus}>
         Add & Re-run
       </QuickActionButton>
    </div>
  );
};

// ResponseStatus and ResponseStateManager (No changes)
const ResponseStatus = ({ providerId, response }) => {
    const provider = AVAILABLE_PROVIDERS.find(p => p.id === providerId);
    if (!provider) return null;

    const getStatusInfo = () => {
        const status = response?.status || "pending";
        switch (status) {
            case 'pending':
                return { text: 'Pending...', icon: <Loader size={14} className="animate-spin text-gray-400" />, color: 'text-gray-400' };
            case 'completed':
                return { text: 'Completed', icon: <Check size={14} className="text-green-500" />, color: 'text-green-500' };
            case 'error':
                return { text: 'Error', icon: <X size={14} className="text-red-500" />, color: 'text-red-500' };
            default:
                return { text: 'Unknown', icon: null, color: 'text-gray-500' };
        }
    };

    const { text, icon, color } = getStatusInfo();

    return (
        <div className={`flex items-center gap-3 p-3 rounded-lg bg-black/20 transition-all duration-300`}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: provider.logoColor }}></div>
            <span className="font-medium text-white flex-1">{provider.name}</span>
            <div className={`flex items-center gap-2 text-sm ${color}`}>
                {icon}
                <span>{text}</span>
            </div>
        </div>
    );
};

const ResponseStateManager = ({ responses, targetProviders }) => {
    if (targetProviders.length === 0) return null;

    return (
        <div className="w-full mt-6 p-4 bg-black/20 rounded-xl border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-3">Execution Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {targetProviders.map(providerId => (
                    <ResponseStatus
                        key={providerId}
                        providerId={providerId}
                        response={responses.get(providerId)}
                    />
                ))}
            </div>
        </div>
    );
};


// --- ROOT ORCHESTRATION COMPONENT (UPDATED) ---
const PromptCanvas = () => {
  const [promptState, setPromptState] = useState({
    text: "",
    targetProviders: AVAILABLE_PROVIDERS.filter(p => p.status === 'ready').map(p => p.id),
    executionId: null,
    status: "composing", // composing | executing | completed | error
    responses: new Map()
  });

  const isExecuting = promptState.status === 'executing';

  const updatePromptState = (updates) => {
    setPromptState(prev => ({ ...prev, ...updates }));
  };

  const handleClear = () => {
      setPromptState({
        text: "",
        targetProviders: AVAILABLE_PROVIDERS.filter(p => p.status === 'ready').map(p => p.id),
        executionId: null,
        status: "composing",
        responses: new Map()
      });
  };

  // ✨ NEW: Handler for inserting template text ✨
  const handleInsertTemplate = (templateText) => {
    updatePromptState({
      text: promptState.text 
        ? `${promptState.text.trim()}\n\n${templateText}`
        : templateText
    });
    // Focus the textarea after inserting for a smooth UX
    document.getElementById('prompt-input')?.focus();
  };


  // Mocked execution logic
  const handlePromptExecution = useCallback(async (currentPromptState) => {
    const executionId = generateId();
    updatePromptState({
      executionId,
      status: "executing",
      responses: new Map(currentPromptState.targetProviders.map(p => [p, { status: 'pending' }]))
    });

    // Simulate API calls
    const executionPromises = currentPromptState.targetProviders.map(providerId => {
      return new Promise(resolve => {
        const delay = 2000 + Math.random() * 2000;
        const shouldFail = Math.random() < 0.2; 
        setTimeout(() => {
          setPromptState(prev => {
            const newResponses = new Map(prev.responses);
            if (shouldFail) {
              newResponses.set(providerId, { status: 'error', error: 'Failed to fetch response' });
            } else {
              newResponses.set(providerId, { status: 'completed', data: `Mock response from ${providerId}.` });
            }
            return { ...prev, responses: newResponses };
          });
          resolve();
        }, delay);
      });
    });

    await Promise.allSettled(executionPromises);
    updatePromptState({ status: "completed" });
  }, []);

  const handleRetry = () => {
      const failedProviders = promptState.targetProviders.filter(p => promptState.responses.get(p)?.status === 'error');
      if (failedProviders.length > 0) {
          const newPromptState = { ...promptState, targetProviders: failedProviders };
          handlePromptExecution(newPromptState);
      }
  };
  
  const handleEdit = () => {
      updatePromptState({ status: 'composing' });
  }
  
  const handleAddProvider = () => {
      updatePromptState({ status: 'composing' });
  }

  return (
    <div className="bg-gray-900 min-h-screen p-4 sm:p-8 flex items-center justify-center font-sans">
        <div className="w-full max-w-3xl mx-auto">
          <div className="bg-gradient-to-br from-gray-800/50 via-gray-900 to-black p-6 rounded-2xl shadow-2xl shadow-black/50 border border-white/10 flex flex-col gap-5">
            
            {/* ✨ MODIFIED: Added PromptTemplateBar and composer wrapper div ✨ */}
            <div>
              <PromptTemplateBar onInsert={handleInsertTemplate} disabled={isExecuting} />
              <PromptComposer
                value={promptState.text}
                onChange={(text) => updatePromptState({ text })}
                disabled={isExecuting}
              />
            </div>

            <ProviderSelector
              available={AVAILABLE_PROVIDERS}
              selected={promptState.targetProviders}
              onSelectionChange={(providers) => updatePromptState({ targetProviders: providers })}
              disabled={isExecuting}
            />
            
            <div className="h-[1px] bg-white/10 w-full my-2"></div>

            <ExecutionController
              promptState={promptState}
              onExecute={handlePromptExecution}
              onClear={handleClear}
              onEdit={handleEdit}
              onRetry={handleRetry}
              onAddProvider={handleAddProvider}
            />

            {promptState.status !== "composing" && (
                <ResponseStateManager
                    responses={promptState.responses}
                    targetProviders={promptState.targetProviders}
                />
            )}
          </div>
          <p className="text-center text-gray-600 mt-6 text-sm">Hybrid Thinking OS - Prompt Canvas</p>
        </div>
    </div>
  );
};


export default function App() {
  return <PromptCanvas />;
}