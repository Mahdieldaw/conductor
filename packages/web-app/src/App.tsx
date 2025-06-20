import React, { useState, useEffect } from 'react';
import { sidecarService } from './services/SidecarService';
import { PromptCanvas } from './components/PromptCanvas'; // We will create this next
import { ReadinessGate } from './components/ReadinessGate';

// A simple component to get the Extension ID from the developer
const ExtensionConnector = ({ onConnect }) => {
  const [extensionId, setExtensionId] = useState('');

  useEffect(() => {
    const savedId = localStorage.getItem('hybrid-thinking-extension-id');
    if (savedId) setExtensionId(savedId);
  }, []);

  const handleConnect = () => {
    if (extensionId.trim()) {
      localStorage.setItem('hybrid-thinking-extension-id', extensionId.trim());
      onConnect(extensionId.trim());
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-slate-200">
      <div className="p-8 bg-slate-800 rounded-lg shadow-2xl border border-slate-700 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-white mb-2">Connect to Sidecar</h1>
        <p className="text-slate-400 text-center mb-6">
          Paste the ID of the loaded Hybrid Thinking OS extension from <code>chrome://extensions</code>.
        </p>
        <input
          type="text"
          value={extensionId}
          onChange={(e) => setExtensionId(e.target.value)}
          placeholder="e.g., aaaaaaaaaaaaaaaaaaaaaaa"
          className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-md mb-4 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
        <button
          onClick={handleConnect}
          disabled={!extensionId.trim()}
          className="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
        >
          Connect
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const [connection, setConnection] = useState<null | { tabId: number; sessionId: string }>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState({
    status: 'idle', // idle | connecting | connected | error
    error: null,
  });

  // Example provider list for MVP
  const providers = [
    { key: 'chatgpt', name: 'ChatGPT' },
    { key: 'claude', name: 'Claude' }
  ];

  const handleConnect = async (extensionId) => {
    setConnectionState({ status: 'connecting', error: null });
    try {
      await sidecarService.connect(extensionId);
      setConnectionState({ status: 'connected', error: null });
    } catch (err) {
      setConnectionState({ status: 'error', error: err.message });
    }
  };

  if (connection) {
    return <PromptCanvas />;
  }

  return (
    <div>
      {!selectedProvider && (
        <div className="flex flex-col items-center mt-10">
          <h2 className="text-xl font-bold mb-2">1. Choose Provider</h2>
          <div className="flex gap-4">
            {providers.map(p => (
              <button key={p.key} onClick={() => setSelectedProvider(p.key)} className="bg-indigo-600 text-white px-4 py-2 rounded">
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {selectedProvider && !connection && (
        <>
          <h2 className="text-xl font-bold mt-8 mb-2">2. Connect</h2>
          <ReadinessGate
            providerKey={selectedProvider}
            onReady={({ tabId, sessionId }) => {
              setConnection({ tabId, sessionId });
              // updatePromptState({ targetProviders: [selectedProvider] }); // Uncomment if needed
            }}
          />
        </>
      )}
      {connectionState.status !== 'connected' && <ExtensionConnector onConnect={handleConnect} />}
      {connectionState.status === 'connecting' && <p className="text-center text-blue-400 mt-4">Connecting...</p>}
      {connectionState.status === 'error' && <p className="text-center text-red-400 mt-4">Connection Failed: {connectionState.error}</p>}
    </div>
  );
}
