import React, { useState, useEffect, useCallback } from 'react';
import { sidecarService } from './services/SidecarService';
import { PromptCanvas } from './components/PromptCanvas';
import './App.css';
import { WorkflowRunner } from './components/WorkflowRunner';
import { MemoryViewer } from './components/MemoryViewer';
import { ResultsDisplay } from './components/ResultsDisplay';
import { RecentActivitySidebar } from './components/RecentActivitySidebar';

// Define types for our state
interface WorkflowExecutionState {
  activeSessionId: string | null;
  isRunning: boolean;
  steps: any[];
  results: Map<string, any>;
  finalSynthesis: any | null;
  error: string | null;
}

interface RecentActivityState {
  recentWorkflows: any[];
  recentPromptOutputs: Record<string, any[]>;
}

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
  const [activeTab, setActiveTab] = useState('prompt'); // 'prompt', 'workflow', 'results', 'memory'
  
  // State for managing workflow execution in real-time
  const [workflowExecution, setWorkflowExecution] = useState<WorkflowExecutionState>({
    activeSessionId: null,
    isRunning: false,
    steps: [],
    results: new Map(),
    finalSynthesis: null,
    error: null,
  });

  // State for the short-term memory/cache
  const [recentActivity, setRecentActivity] = useState<RecentActivityState>({
    recentWorkflows: [],
    recentPromptOutputs: {},
  });

  // Fetch initial cache data on load
  useEffect(() => {
    const fetchCache = async () => {
      try {
        const cache = await sidecarService.getCompleteHotCache();
        if (cache) {
          setRecentActivity(cache);
        }
      } catch (error) {
        console.error('Failed to fetch initial cache:', error);
      }
    };
    if (isConnected) {
      fetchCache();
    }
  }, [isConnected]);

  // Listen for real-time messages from the service worker
  useEffect(() => {
    if (!isConnected) return;

    const handleMessage = (message: any) => {
      // Listen for workflow progress updates
      if (message.type === 'WORKFLOW_UPDATE' && message.sessionId === workflowExecution.activeSessionId) {
        setWorkflowExecution(prev => {
          const newResults = new Map(prev.results);
          if (message.data.result) {
            newResults.set(message.data.stepId, message.data.result);
          }
          
          // Check for completion
          const isComplete = message.data.status === 'completed';
          if (isComplete) {
            // A workflow just finished, so we should refresh our recent activity cache
            sidecarService.getCompleteHotCache().then(cache => setRecentActivity(cache));
          }

          return {
            ...prev,
            isRunning: !isComplete,
            results: newResults,
            finalSynthesis: isComplete ? message.data.finalSynthesis : prev.finalSynthesis,
            error: message.data.error || null,
          };
        });
      }
      
      // Listen for single prompt completions to update the cache
      if (message.type === 'PROMPT_COMPLETED') {
         sidecarService.getCompleteHotCache().then(cache => setRecentActivity(cache));
      }
    };

    sidecarService.addMessageListener(handleMessage);
    return () => sidecarService.removeMessageListener(handleMessage);
  }, [workflowExecution.activeSessionId, isConnected]);

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

  const handleRunWorkflow = useCallback(async (workflow: any) => {
    // Reset state for a new run
    setWorkflowExecution({
      activeSessionId: null,
      isRunning: true,
      steps: workflow.steps,
      results: new Map(),
      finalSynthesis: null,
      error: null,
    });
    // Switch to results view automatically
    setActiveTab('results');
    try {
      const sessionId = await sidecarService.executeWorkflow(workflow);
      setWorkflowExecution(prev => ({ ...prev, activeSessionId: sessionId }));
    } catch (error) {
      setWorkflowExecution(prev => ({ ...prev, isRunning: false, error: error.message }));
    }
  }, []);
  
  const handleUseRecentOutput = (text: string) => {
      // Copy to clipboard and switch to prompt canvas
      navigator.clipboard.writeText(text);
      setActiveTab('prompt');
      // Could also implement direct insertion into active input field
  };

  const handleLoadWorkflow = (workflow: any) => {
    // Load workflow results into the results view
    setWorkflowExecution({
      activeSessionId: workflow.sessionId,
      isRunning: false,
      steps: workflow.steps || [],
      results: new Map(Object.entries(workflow.results || {})),
      finalSynthesis: workflow.finalSynthesis || null,
      error: null,
    });
    setActiveTab('results');
  };
  
  if (!isConnected) {
    return <ExtensionConnector onConnect={handleConnect} connectionState={connectionState} />;
  }
  
  // Once connected, render the main application with unified state management
  return (
    <div className="app" style={{ display: 'flex', height: '100vh', background: '#1a1a1a', color: 'white' }}>
      <RecentActivitySidebar 
        activity={recentActivity}
        onUseOutput={handleUseRecentOutput}
        onLoadWorkflow={handleLoadWorkflow}
      />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <nav className="app-nav">
          <button 
            className={activeTab === 'prompt' ? 'active' : ''}
            onClick={() => setActiveTab('prompt')}
          >
            Single Prompt
          </button>
          <button 
            className={activeTab === 'workflow' ? 'active' : ''}
            onClick={() => setActiveTab('workflow')}
          >
            Workflow Builder
          </button>
          <button 
            className={activeTab === 'results' ? 'active' : ''}
            onClick={() => setActiveTab('results')}
          >
            Results
          </button>
          <button 
            className={activeTab === 'memory' ? 'active' : ''}
            onClick={() => setActiveTab('memory')}
          >
            Memory Viewer
          </button>
        </nav>
        <div className="app-main" style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
          {activeTab === 'prompt' && <PromptCanvas />}
          {activeTab === 'workflow' && (
            <WorkflowRunner 
              executionState={{
                isRunning: workflowExecution.isRunning,
                currentStep: workflowExecution.steps.findIndex(step => step.status === 'running'),
                error: workflowExecution.error,
                sessionId: workflowExecution.activeSessionId
              }}
              onRunWorkflow={handleRunWorkflow}
              onStopWorkflow={() => {
                // Stop workflow logic - for now just reset state
                setWorkflowExecution(prev => ({
                  ...prev,
                  isRunning: false,
                  error: 'Workflow stopped by user'
                }));
              }}
            />
          )}
          {activeTab === 'results' && <ResultsDisplay workflowState={workflowExecution} />}
          {activeTab === 'memory' && <MemoryViewer />}
        </div>
      </main>
    </div>
  );
}
