import React from 'react';
import { ResponseCard } from './ResponseCard';
import type { Provider, ResponseState } from '../types';

interface ResultsDisplayProps {
  responses: Map<string, ResponseState>;
  providers: Provider[];
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ responses, providers }) => {
  // Should render null or nothing if the responses map is empty
  if (responses.size === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from(responses.entries()).map(([providerId, responseState]) => {
        const provider = providers.find(p => p.id === providerId);
        if (!provider) return null;
        
        return (
          <ResponseCard
            key={providerId}
            provider={provider}
            responseState={responseState}
          />
        );
      })}
    </div>
  );
};