import React from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import type { Provider, ResponseState } from '../types';

interface ResponseCardProps {
  provider: Provider;
  responseState: ResponseState;
}

export const ResponseCard: React.FC<ResponseCardProps> = ({ provider, responseState }) => {
  const getStatusIcon = () => {
    switch (responseState.status) {
      case 'pending':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-400" />;
      case 'completed':
        return <Check className="w-5 h-5 text-green-500" />;
      case 'error':
        return <X className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (responseState.status) {
      case 'pending':
        return 'Processing...';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = () => {
    switch (responseState.status) {
      case 'pending':
        return 'text-blue-400';
      case 'completed':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: provider.logoColor }}
          ></div>
          <h3 className="text-lg font-semibold text-white">{provider.name}</h3>
        </div>
        
        {/* Status Indicator */}
        <div className={`flex items-center gap-2 text-sm ${getStatusColor()}`}>
          {getStatusIcon()}
          <span>{getStatusText()}</span>
        </div>
      </div>

      {/* Content Body */}
      <div className="mt-4">
        {responseState.status === 'completed' && responseState.data && (
          <div className="bg-black/30 rounded-lg p-4 border border-slate-600">
            <pre className="text-gray-200 text-sm whitespace-pre-wrap font-mono select-text overflow-auto max-h-96">
              {responseState.data}
            </pre>
          </div>
        )}
        
        {responseState.status === 'error' && responseState.error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
            <p className="text-red-300 text-sm">
              <span className="font-semibold">Error:</span> {responseState.error}
            </p>
          </div>
        )}
        
        {responseState.status === 'pending' && (
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-300 text-sm">
              Waiting for response from {provider.name}...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};