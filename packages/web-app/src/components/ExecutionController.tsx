import React from 'react';
import { Send, Pencil, RotateCw, Plus } from 'lucide-react';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';
import { QuickActionButton } from './QuickActionButton';
import type { PromptState } from '../types';

interface ExecutionControllerProps {
  promptState: PromptState;
  onExecute: () => void;
  onClear: () => void;
  onEdit: () => void;
  onRetry: () => void;
  onAddProvider: () => void;
}

// Use 'any' for icon props to work around Lucide/React type issues
export const ExecutionController: React.FC<ExecutionControllerProps> = ({ promptState, onExecute, onClear, onEdit, onRetry, onAddProvider }) => {
  const isExecuting = promptState.status === 'executing';
  const hasResponses = promptState.responses.size > 0;
  const hasFailedProviders = Array.from(promptState.responses.values()).some(r => r.status === 'error');

  if (isExecuting) {
    return (
      <div className="flex items-center gap-3 text-lg font-semibold text-gray-300 mt-4 p-3 bg-white/5 rounded-lg">
        <span className="animate-spin text-indigo-400">
          <svg
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
          </svg>
        </span>
        <span>Executing on {promptState.targetProviders.length} providers...</span>
      </div>
    );
  }

  if (!hasResponses) {
    return (
      <div className="flex flex-col sm:flex-row items-center gap-3 mt-4 w-full">
        <PrimaryButton
          onClick={onExecute}
          disabled={!promptState.text.trim() || promptState.targetProviders.length === 0}
          icon={Send as any}
        >
          Send to {promptState.targetProviders.length} provider(s)
        </PrimaryButton>
        <SecondaryButton onClick={onClear}>Clear</SecondaryButton>
      </div>
    );
  }

  // Post-execution actions
  return (
    <div className="flex flex-wrap items-center gap-3 mt-4 p-3 bg-white/5 rounded-lg">
      <span className="text-gray-300 font-medium mr-2">Next:</span>
      <QuickActionButton onClick={onEdit} icon={Pencil as any}>
        Edit & Re-send
      </QuickActionButton>
      {hasFailedProviders && (
         <QuickActionButton onClick={onRetry} icon={RotateCw as any}>
           Retry Failed
         </QuickActionButton>
      )}
       <QuickActionButton onClick={onAddProvider} icon={Plus as any}>
         Add & Re-run
       </QuickActionButton>
    </div>
  );
};
