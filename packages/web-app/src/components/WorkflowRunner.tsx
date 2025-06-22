import React, { useState, useEffect } from 'react';
import { sidecarService } from '../services/SidecarService';
import './WorkflowRunner.css';

interface WorkflowStep {
  id: string;
  prompt: string;
  provider: 'chatgpt' | 'claude';
  expectedOutput?: string;
  timeout?: number;
}

interface SynthesisStep {
  provider: 'chatgpt' | 'claude';
  prompt: string;
  enabled: boolean;
}

interface WorkflowRunnerProps {
  onWorkflowComplete?: (result: any) => void;
  onWorkflowError?: (error: any) => void;
}

export const WorkflowRunner: React.FC<WorkflowRunnerProps> = ({
  onWorkflowComplete,
  onWorkflowError
}) => {
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [synthesisStep, setSynthesisStep] = useState<SynthesisStep>({
    provider: 'chatgpt',
    prompt: 'Please synthesize the following responses into a comprehensive answer:\n\n{{outputs}}',
    enabled: false
  });
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Tab management removed - providers are now selected per step

  const addStep = () => {
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      provider: 'chatgpt',
      prompt: '',
      timeout: 30000
    };
    setWorkflowSteps([...workflowSteps, newStep]);
  };

  const setupMultiProviderWorkflow = () => {
    const claudeStep: WorkflowStep = {
      id: 'claude_step',
      provider: 'claude',
      prompt: 'Enter your prompt here - this will be sent to Claude',
      timeout: 30000
    };
    
    const chatgptStep: WorkflowStep = {
      id: 'chatgpt_step',
      provider: 'chatgpt',
      prompt: 'Enter your prompt here - this will be sent to ChatGPT',
      timeout: 30000
    };
    
    setWorkflowSteps([claudeStep, chatgptStep]);
    setSynthesisStep({
      provider: 'chatgpt',
      prompt: 'I have received responses from both Claude and ChatGPT for the same prompt. Please synthesize these responses into a single, comprehensive answer that combines the best insights from both:\n\nClaude\'s response: {{outputs.claude_step}}\n\nChatGPT\'s response: {{outputs.chatgpt_step}}\n\nPlease provide a synthesized response that:',
      enabled: true
    });
  };

  const updateStep = (index: number, field: keyof WorkflowStep, value: any) => {
    const updatedSteps = [...workflowSteps];
    updatedSteps[index] = { ...updatedSteps[index], [field]: value };
    setWorkflowSteps(updatedSteps);
  };

  const removeStep = (index: number) => {
    const updatedSteps = workflowSteps.filter((_, i) => i !== index);
    setWorkflowSteps(updatedSteps);
  };

  const executeWorkflow = async () => {
    if (!selectedTabId || workflowSteps.length === 0) {
      setError('Please select a tab and add at least one step');
      return;
    }

    setIsRunning(true);
    setError(null);
    setResults([]);
    setCurrentStep(0);

    try {
      const workflowId = `workflow-${Date.now()}`;
      
      // Prepare workflow data with synthesis step if enabled
      const workflowData = {
        id: workflowId,
        steps: workflowSteps,
        ...(synthesisStep.enabled && {
          synthesis: {
            provider: synthesisStep.provider,
            prompt: synthesisStep.prompt
          }
        })
      };
      
      const response = await sidecarService.executeWorkflow(
        workflowId,
        workflowData,
        null, // No specific tab needed since providers are selected per step
        { timeout: 60000 }
      );

      setSessionId(response.sessionId);
      
      // Poll for status updates
      pollWorkflowStatus(response.sessionId);
    } catch (err: any) {
      setError(err.message || 'Failed to execute workflow');
      setIsRunning(false);
      onWorkflowError?.(err);
    }
  };

  const pollWorkflowStatus = async (sessionId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const status = await sidecarService.getWorkflowStatus(sessionId);
        
        if (status.currentStep !== undefined) {
          setCurrentStep(status.currentStep);
        }

        if (status.status === 'completed') {
          clearInterval(pollInterval);
          const result = await sidecarService.getWorkflowResult(sessionId);
          setResults(result.stepResults || []);
          setIsRunning(false);
          setCurrentStep(-1);
          onWorkflowComplete?.(result);
        } else if (status.status === 'failed') {
          clearInterval(pollInterval);
          setError(status.error || 'Workflow failed');
          setIsRunning(false);
          setCurrentStep(-1);
          onWorkflowError?.(status.error);
        }
      } catch (err) {
        console.error('Failed to poll workflow status:', err);
      }
    }, 1000);

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 300000);
  };

  const stopWorkflow = () => {
    setIsRunning(false);
    setCurrentStep(-1);
    setError('Workflow stopped by user');
  };

  return (
    <div className="workflow-runner">
      <div className="workflow-header">
        <h2>Workflow Runner</h2>
      </div>

      <div className="workflow-steps">
        <h3>Workflow Steps</h3>
        {workflowSteps.map((step, index) => (
          <div 
            key={step.id} 
            className={`step ${currentStep === index ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
          >
            <div className="step-header">
              <span className="step-number">{index + 1}</span>
              <input
                type="text"
                placeholder="Step description (optional)"
                value={step.id}
                onChange={(e) => updateStep(index, 'id', e.target.value)}
                disabled={isRunning}
              />
              <button 
                onClick={() => removeStep(index)}
                disabled={isRunning}
                className="remove-step"
              >
                ×
              </button>
            </div>
            <div className="step-options">
              <label>
                Provider:
                <select
                  value={step.provider}
                  onChange={(e) => updateStep(index, 'provider', e.target.value as 'chatgpt' | 'claude')}
                  disabled={isRunning}
                >
                  <option value="chatgpt">ChatGPT</option>
                  <option value="claude">Claude</option>
                </select>
              </label>
              <label>
                Timeout (ms):
                <input
                  type="number"
                  value={step.timeout || 30000}
                  onChange={(e) => updateStep(index, 'timeout', Number(e.target.value))}
                  disabled={isRunning}
                  min={1000}
                  max={300000}
                />
              </label>
            </div>
            <textarea
              placeholder="Enter the prompt for this step..."
              value={step.prompt}
              onChange={(e) => updateStep(index, 'prompt', e.target.value)}
              disabled={isRunning}
              rows={3}
            />
          </div>
        ))}
        
        <div className="step-controls">
          <button 
            onClick={addStep}
            disabled={isRunning}
            className="add-step"
          >
            + Add Step
          </button>
          
          <button 
            onClick={setupMultiProviderWorkflow}
            disabled={isRunning}
            className="setup-multi-provider"
          >
            🚀 Quick Setup: Multi-Provider Synthesis
          </button>
        </div>
      </div>

      <div className="synthesis-section">
        <h3>Synthesis Step (Optional)</h3>
        <div className="synthesis-toggle">
          <label>
            <input
              type="checkbox"
              checked={synthesisStep.enabled}
              onChange={(e) => setSynthesisStep(prev => ({ ...prev, enabled: e.target.checked }))}
              disabled={isRunning}
            />
            Enable synthesis step to combine outputs from multiple providers
          </label>
        </div>
        
        {synthesisStep.enabled && (
          <div className="synthesis-config">
            <div className="synthesis-options">
              <label>
                Synthesis Provider:
                <select
                  value={synthesisStep.provider}
                  onChange={(e) => setSynthesisStep(prev => ({ ...prev, provider: e.target.value as 'chatgpt' | 'claude' }))}
                  disabled={isRunning}
                >
                  <option value="chatgpt">ChatGPT</option>
                  <option value="claude">Claude</option>
                </select>
              </label>
            </div>
            <textarea
              placeholder="Enter the synthesis prompt... Use {{outputs}} to reference all step outputs."
              value={synthesisStep.prompt}
              onChange={(e) => setSynthesisStep(prev => ({ ...prev, prompt: e.target.value }))}
              disabled={isRunning}
              rows={4}
            />
          </div>
        )}
      </div>

      <div className="workflow-controls">
        {!isRunning ? (
          <button 
            onClick={executeWorkflow}
            disabled={workflowSteps.length === 0}
            className="execute-btn"
          >
            Execute Workflow
          </button>
        ) : (
          <button onClick={stopWorkflow} className="stop-btn">
            Stop Workflow
          </button>
        )}
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {isRunning && (
        <div className="workflow-status">
          <div className="status-indicator">
            <div className="spinner"></div>
            <span>Running step {currentStep + 1} of {workflowSteps.length}...</span>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="workflow-results">
          <h3>Results</h3>
          {results.map((result, index) => (
            <div key={index} className="result-item">
              <h4>Step {index + 1}: {workflowSteps[index]?.id || `Step ${index + 1}`}</h4>
              <div className="result-content">
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};