import React from 'react';
import type { Provider, ResponseState } from '../types';

// Sub-component for a single response status
const ResponseStatus: React.FC<{ provider: Provider; response?: ResponseState; }> = ({ provider, response }) => {
    const getStatusInfo = () => {
        const status = response?.status || "pending";
        switch (status) {
            case 'pending':
                return { text: 'Pending...', icon: <span className="animate-spin text-gray-400"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" /></svg></span>, color: 'text-gray-400' };
            case 'completed':
                return { text: 'Completed', icon: <span className="text-green-500"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg></span>, color: 'text-green-500' };
            case 'error':
                return { text: 'Error', icon: <span className="text-red-500"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></span>, color: 'text-red-500' };
            default:
                return { text: 'Unknown', icon: null, color: 'text-gray-500' };
        }
    };

    const { text, icon, color } = getStatusInfo();

    return (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-black/20">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: provider.logoColor }}></div>
            <span className="font-medium text-white flex-1">{provider.name}</span>
            <div className={`flex items-center gap-2 text-sm ${color}`}>
                {icon}
                <span>{text}</span>
            </div>
        </div>
    );
};


interface ResponseStateManagerProps {
  responses: Map<string, ResponseState>;
  providers: Provider[];
}

// Main container component
export const ResponseStateManager: React.FC<ResponseStateManagerProps> = ({ responses, providers }) => {
    const executedProviderIds = Array.from(responses.keys());
    if (executedProviderIds.length === 0) return null;

    return (
        <div className="w-full mt-6 p-4 bg-black/20 rounded-xl border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-3">Execution Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {executedProviderIds.map(providerId => {
                    const providerConfig = providers.find(p => p.id === providerId);
                    if (!providerConfig) return null;
                    return (
                        <ResponseStatus
                            key={providerId}
                            provider={providerConfig}
                            response={responses.get(providerId)}
                        />
                    )
                })}
            </div>
        </div>
    );
};
