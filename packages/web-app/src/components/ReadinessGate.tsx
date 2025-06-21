import React, { useState, useEffect } from 'react';
import { sidecarService } from '../services/SidecarService';

interface ReadinessGateProps {
  providerKey: string;
  onReady: (data: { tabId: number; sessionId: string }) => void;
}

export const ReadinessGate: React.FC<ReadinessGateProps> = ({ providerKey, onReady }) => {
  const [status, setStatus] = useState('PENDING');
  const [message, setMessage] = useState('Initializing connection…');
  const [providerUrl, setProviderUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    const checkReadiness = async () => {
      try {
        setStatus('PENDING');
        setMessage('Checking readiness…');
        
        const result = await sidecarService.checkReadiness(providerKey);
        
        setStatus(result.status);
        setMessage(result.message);
        
        if (result.data?.url) {
          setProviderUrl(result.data.url);
        }
        
        if (result.status === 'READY' && result.data) {
          onReady(result.data);
        }
      } catch (error) {
        setStatus('ERROR');
        setMessage(`Connection error: ${error.message}`);
      }
    };
    
    checkReadiness();
  }, [providerKey, onReady]);

  return (
    <div>
      <p>{message}</p>
      {status === 'TAB_NOT_OPEN' && providerUrl && (
        <button onClick={() => window.open(providerUrl, '_blank')}>Open Provider</button>
      )}
      {status === 'LOGIN_REQUIRED' && (
        <button onClick={() => window.location.reload()}>Reload & Login</button>
      )}
    </div>
  );
};
