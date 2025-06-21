// Enhanced ProviderSelector.tsx with rich status display
import React from 'react';
import { getStatusDisplay } from '../utils/readinessUtils';
import type { Provider } from '../types';

interface ProviderChipProps {
  provider: Provider;
  selected: boolean;
  onClick: () => void;
  onFix: () => void;
  disabled: boolean;
}

const ProviderChip: React.FC<ProviderChipProps> = ({ 
  provider, 
  selected, 
  onClick, 
  onFix, 
  disabled 
}) => {
  const { color, icon, tooltip, isActionable, isSelectable } = getStatusDisplay(provider.status);
  
  const handleClick = () => {
    if (isSelectable && !disabled) {
      onClick();
    } else if (isActionable && !provider.isCheckInProgress) {
      onFix();
    }
  };

  const getChipStyles = () => {
    const baseStyles = "relative group flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200";
    
    if (provider.isCheckInProgress || disabled) {
      return `${baseStyles} opacity-60 cursor-wait bg-white/5 border-slate-700 text-gray-300`;
    }
    
    if (selected && isSelectable) {
      return `${baseStyles} bg-white/15 ring-2 border-2 text-white cursor-pointer hover:bg-white/20`;
    }
    
    if (isActionable) {
      return `${baseStyles} bg-white/5 border-slate-600 text-gray-300 hover:bg-white/10 hover:border-slate-500 cursor-pointer border-dashed`;
    }
    
    if (isSelectable) {
      return `${baseStyles} bg-white/5 border-slate-700 text-gray-300 hover:bg-white/10 hover:border-slate-600 cursor-pointer`;
    }
    
    return `${baseStyles} bg-white/5 border-slate-700 text-gray-400 cursor-not-allowed`;
  };

  const getBorderColor = () => {
    if (selected && isSelectable) {
      return { borderColor: provider.logoColor, ringColor: provider.logoColor };
    }
    return {};
  };

  return (
    <button
      onClick={handleClick}
      disabled={provider.isCheckInProgress || (disabled && !isActionable)}
      title={provider.statusMessage || tooltip}
      className={getChipStyles()}
      style={getBorderColor()}
    >
      <div className={`flex items-center gap-2 min-w-0`}>
        <div className={`w-3 h-3 rounded-full transition-colors flex-shrink-0 ${color}`} />
        <span className="truncate">{provider.name}</span>
        <span className="text-xs opacity-70 flex-shrink-0">{icon}</span>
      </div>
      
      {selected && isSelectable && (
        <span className="text-green-400 flex-shrink-0">✓</span>
      )}
      
      {isActionable && !provider.isCheckInProgress && (
        <span className="text-amber-400 font-bold flex-shrink-0">!</span>
      )}
      
      {provider.isCheckInProgress && (
        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
      )}
    </button>
  );
};

interface AllToggleProps {
  allSelected: boolean;
  onToggle: () => void;
  disabled: boolean;
  readyCount: number;
}

const AllToggle: React.FC<AllToggleProps> = ({ allSelected, onToggle, disabled, readyCount }) => (
  <button
    onClick={onToggle}
    disabled={disabled || readyCount === 0}
    className={`px-3 py-2 text-sm font-medium rounded-full border transition-all duration-200 ${
      allSelected
        ? 'bg-white/15 border-green-500 text-green-400'
        : disabled || readyCount === 0
        ? 'bg-white/5 border-slate-700 text-gray-500 cursor-not-allowed'
        : 'bg-white/5 border-slate-700 text-gray-300 hover:bg-white/10 hover:border-slate-600 cursor-pointer'
    }`}
    title={readyCount === 0 ? 'No providers ready' : allSelected ? 'Deselect all' : 'Select all ready'}
  >
    All {readyCount > 0 && `(${readyCount})`} {allSelected ? '✓' : '○'}
  </button>
);

interface StatusSummaryProps {
  providers: Provider[];
  hasProvidersNeedingAttention: boolean;
  onCheckAll?: () => void;
  isGlobalCheckInProgress: boolean;
}

const StatusSummary: React.FC<StatusSummaryProps> = ({ 
  providers, 
  hasProvidersNeedingAttention, 
  onCheckAll,
  isGlobalCheckInProgress 
}) => {
  const readyCount = providers.filter(p => p.status === 'ready').length;
  const totalCount = providers.length;
  
  if (isGlobalCheckInProgress) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
        <span>Checking all providers...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span>{readyCount} of {totalCount} providers ready</span>
        {hasProvidersNeedingAttention && (
          <span className="text-amber-400">• Some need attention</span>
        )}
      </div>
      
      {onCheckAll && (
        <button
          onClick={onCheckAll}
          disabled={isGlobalCheckInProgress}
          className="text-sm text-slate-400 hover:text-slate-300 underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Recheck All
        </button>
      )}
    </div>
  );
};

interface ProviderSelectorProps {
  available: Provider[];
  selected: string[];
  onSelectionChange: (providers: string[]) => void;
  onFixProvider: (providerId: string) => void;
  onCheckAll?: () => void;
  disabled: boolean;
  hasProvidersNeedingAttention: boolean;
  isGlobalCheckInProgress: boolean;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({ 
  available, 
  selected, 
  onSelectionChange, 
  onFixProvider,
  onCheckAll,
  disabled,
  hasProvidersNeedingAttention,
  isGlobalCheckInProgress
}) => {
  const readyProviders = available.filter(p => p.status === 'ready');
  const readyProviderIds = readyProviders.map(p => p.id);
  
  const toggleProvider = (providerId: string) => {
    const provider = available.find(p => p.id === providerId);
    if (!provider || provider.status !== 'ready') return;
    
    const newSelection = selected.includes(providerId)
      ? selected.filter(p => p !== providerId)
      : [...selected, providerId];
    onSelectionChange(newSelection);
  };

  const toggleAll = () => {
    const allReadySelected = readyProviderIds.length > 0 && 
                            readyProviderIds.every(id => selected.includes(id));
    onSelectionChange(allReadySelected ? [] : readyProviderIds);
  };

  const allReadySelected = readyProviderIds.length > 0 && 
                          readyProviderIds.every(id => selected.includes(id));

  return (
    <div className="space-y-3">
      <StatusSummary 
        providers={available}
        hasProvidersNeedingAttention={hasProvidersNeedingAttention}
        onCheckAll={onCheckAll}
        isGlobalCheckInProgress={isGlobalCheckInProgress}
      />
      
      <div className="flex flex-wrap items-center gap-2">
        {available.map(provider => (
          <ProviderChip
            key={provider.id}
            provider={provider}
            selected={selected.includes(provider.id)}
            onClick={() => toggleProvider(provider.id)}
            onFix={() => onFixProvider(provider.id)}
            disabled={disabled}
          />
        ))}
        
        <div className="border-l border-white/10 h-6 mx-2" />
        
        <AllToggle
          allSelected={allReadySelected}
          onToggle={toggleAll}
          disabled={disabled}
          readyCount={readyProviders.length}
        />
      </div>
    </div>
  );
};