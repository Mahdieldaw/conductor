import React from 'react';
import type { Provider } from '../types';

// Standalone chip for a single provider
const ProviderChip: React.FC<{ provider: Provider; selected: boolean; onClick: () => void; disabled: boolean; }> = ({ provider, selected, onClick, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled || provider.status === 'offline'}
      style={selected ? { borderColor: provider.logoColor, color: 'white' } : {}}
      className={`flex items-center justify-between gap-2 px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200 ${selected ? `bg-white/10 ring-2 ring-[${provider.logoColor}]` : 'bg-white/5 border-slate-700 text-gray-300 hover:bg-white/10 hover:border-slate-600'} ${(disabled || provider.status === 'offline') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${provider.status === 'ready' ? 'bg-green-500' : 'bg-gray-500'}`}></span>
        <span>{provider.name}</span>
      </div>
      {selected && <span className="text-green-400"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg></span>}
    </button>
);

// Toggle for selecting all available providers
const AllToggle: React.FC<{ allSelected: boolean; onToggle: () => void; disabled: boolean; }> = ({ allSelected, onToggle, disabled }) => (
  <button
    onClick={onToggle}
    disabled={disabled}
    className={`px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200 ${allSelected ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-slate-700 text-gray-300 hover:bg-white/10'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
    All ✓
  </button>
);

interface ProviderSelectorProps {
  available: Provider[];
  selected: string[];
  onSelectionChange: (providers: string[]) => void;
  disabled: boolean;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({ available, selected, onSelectionChange, disabled }) => {
  const toggleProvider = (providerId: string) => {
    const newSelection = selected.includes(providerId)
      ? selected.filter(p => p !== providerId)
      : [...selected, providerId];
    onSelectionChange(newSelection);
  };

  const toggleAll = () => {
    const allReadyIds = available.filter(p => p.status === 'ready').map(p => p.id);
    onSelectionChange(selected.length === allReadyIds.length ? [] : allReadyIds);
  };

  const allReadyProvidersSelected = selected.length === available.filter(p => p.status === 'ready').length && selected.length > 0;

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
        allSelected={allReadyProvidersSelected}
        onToggle={toggleAll}
        disabled={disabled}
      />
    </div>
  );
};
