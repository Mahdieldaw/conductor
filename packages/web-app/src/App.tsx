import React, { useState, useEffect } from 'react';
import { sidecarService } from './services/SidecarService';
import { PromptCanvas } from './components/PromptCanvas';

// A simple component to get the Extension ID from the developer
const ExtensionConnector = ({ onConnect, connectionState }) => {
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
          disabled={!extensionId.trim() || connectionState.status === 'connecting'}
          className="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
        >
          {connectionState.status === 'connecting' ? 'Connecting...' : 'Connect'}
        </button>
        {connectionState.status === 'error' && <p className="text-center text-red-400 mt-4">Connection Failed: {connectionState.error}</p>}
      </div>
    </div>
  );
};

export default function App() {
  const [isConnected, setIsConnected] = useState(sidecarService.isReady);
  const [connectionState, setConnectionState] = useState({ status: 'idle', error: null });

  const handleConnect = async (extensionId) => {
    setConnectionState({ status: 'connecting', error: null });
    try {
      await sidecarService.connect(extensionId);
      setConnectionState({ status: 'connected', error: null });
      setIsConnected(true);
    } catch (err) {
      setConnectionState({ status: 'error', error: err.message });
      setIsConnected(false);
    }
  };
  
  if (!isConnected) {
    return <ExtensionConnector onConnect={handleConnect} connectionState={connectionState} />;
  }
  
  // Once connected, render the main application canvas.
  return <PromptCanvas />;
}
