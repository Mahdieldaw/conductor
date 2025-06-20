import React, { useEffect, useState } from 'react';

// Declare chrome as a global variable for TypeScript
declare const chrome: any;

interface ReadinessGateProps {
  providerKey: string;
  onReady: (data: { tabId: number; sessionId: string }) => void;
}

export const ReadinessGate: React.FC<ReadinessGateProps> = ({ providerKey, onReady }) => {
  const [status, setStatus] = useState('PENDING');
  const [message, setMessage] = useState('Initializing connection…');
  const [providerUrl, setProviderUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    const port = chrome.runtime.connect({ name: 'readiness-pipeline' });
    port.onMessage.addListener(msg => {
      setStatus(msg.status);
      setMessage(msg.message);
      if (msg.data?.url) setProviderUrl(msg.data.url);
      if (msg.status === 'READY' && msg.data) {
        onReady(msg.data);
      }
    });
    port.postMessage({ action: 'CHECK_READINESS', providerKey });
    return () => port.disconnect();
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
