import React, { useState } from 'react';
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

interface WorkflowExecutionState {
  isRunning: boolean;
  currentStep: number;
  error: string | null;
  sessionId: string | null;
}

interface WorkflowRunnerProps {
  executionState: WorkflowExecutionState;
  onRunWorkflow: (workflow: { steps: WorkflowStep[], synthesis: SynthesisStep }) => void;
  onStopWorkflow: () => void;
}

export const WorkflowRunner: React.FC<WorkflowRunnerProps> = ({
  executionState,
  onRunWorkflow,
  onStopWorkflow
}) => {
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [synthesisStep, setSynthesisStep] = useState<SynthesisStep>({
    provider: 'chatgpt',
    prompt: 'Please synthesize the following responses into a comprehensive answer:\n\n{{outputs}}',
    enabled: false
  });

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

  const executeWorkflow = () => {
    if (workflowSteps.length === 0) {
      return;
    }
    
    // Create the workflow object structure expected by the parent component
    const workflow = {
      steps: workflowSteps,
      synthesis: synthesisStep
    };
    
    onRunWorkflow(workflow);
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
            className={`step ${executionState.currentStep === index ? 'active' : ''} ${index < executionState.currentStep ? 'completed' : ''}`}
          >
            <div className="step-header">
              <span className="step-number">{index + 1}</span>
              <input
                type="text"
                placeholder="Step description (optional)"
                value={step.id}
                onChange={(e) => updateStep(index, 'id', e.target.value)}
                disabled={executionState.isRunning}
              />
              <button 
                onClick={() => removeStep(index)}
                disabled={executionState.isRunning}
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
                  disabled={executionState.isRunning}
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
                  disabled={executionState.isRunning}
                  min={1000}
                  max={300000}
                />
              </label>
            </div>
            <textarea
              placeholder="Enter the prompt for this step..."
              value={step.prompt}
              onChange={(e) => updateStep(index, 'prompt', e.target.value)}
              disabled={executionState.isRunning}
              rows={3}
            />
          </div>
        ))}
        
        <div className="step-controls">
          <button 
            onClick={addStep}
            disabled={executionState.isRunning}
            className="add-step"
          >
            + Add Step
          </button>
          
          <button 
            onClick={setupMultiProviderWorkflow}
            disabled={executionState.isRunning}
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
              disabled={executionState.isRunning}
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
                  disabled={executionState.isRunning}
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
              disabled={executionState.isRunning}
              rows={4}
            />
          </div>
        )}
      </div>

      <div className="workflow-controls">
        {!executionState.isRunning ? (
          <button 
            onClick={executeWorkflow}
            disabled={workflowSteps.length === 0}
            className="execute-btn"
          >
            Execute Workflow
          </button>
        ) : (
          <button onClick={onStopWorkflow} className="stop-btn">
            Stop Workflow
          </button>
        )}
      </div>

      {executionState.error && (
        <div className="error-message">
          <strong>Error:</strong> {executionState.error}
        </div>
      )}

      {executionState.isRunning && (
        <div className="workflow-status">
          <div className="status-indicator">
            <div className="spinner"></div>
            <span>Running step {executionState.currentStep + 1} of {workflowSteps.length}...</span>
          </div>
        </div>
      )}
    </div>
  );
};