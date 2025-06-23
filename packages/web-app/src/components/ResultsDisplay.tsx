import React from 'react';

interface WorkflowExecutionState {
  activeSessionId: string | null;
  isRunning: boolean;
  steps: any[];
  results: Map<string, any>;
  finalSynthesis: any | null;
  error: string | null;
}

interface ResultsDisplayProps {
  workflowState?: WorkflowExecutionState;
  responses?: Map<string, any>;
  providers?: any[];
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ workflowState, responses, providers }) => {
  // Handle prompt execution results (simple prompt mode)
  if (responses && !workflowState) {
    if (responses.size === 0) {
      return (
        <div className="results-container">
          <h2>No Results Yet</h2>
          <p>Send a prompt to see results here.</p>
        </div>
      );
    }

    return (
      <div className="results-container">
        <div className="results-header" style={{ marginBottom: '2rem' }}>
          <h2>Prompt Results</h2>
        </div>
        
        <div className="prompt-results">
          {Array.from(responses.entries()).map(([providerId, response]) => {
            const provider = providers?.find(p => p.id === providerId);
            const providerName = provider?.name || providerId;
            
            return (
              <div key={providerId} className="result-item" style={{ 
                border: '1px solid #374151', 
                padding: '1.5rem', 
                margin: '1rem 0',
                borderRadius: '0.5rem',
                background: '#1f2937'
              }}>
                <h4 style={{ color: '#f3f4f6', marginBottom: '1rem' }}>
                  {providerName}
                  <span style={{ 
                    marginLeft: '0.5rem', 
                    fontSize: '0.8rem', 
                    color: response.status === 'completed' ? '#10b981' : response.status === 'error' ? '#ef4444' : '#f59e0b'
                  }}>
                    {response.status === 'completed' ? '✅ Completed' : 
                     response.status === 'error' ? '❌ Error' : 
                     '⏳ Pending'}
                  </span>
                </h4>
                
                {response.status === 'completed' && response.data && (
                  <div className="result-content" style={{
                    background: '#111827',
                    padding: '1rem',
                    borderRadius: '0.25rem',
                    border: '1px solid #374151'
                  }}>
                    <pre style={{ 
                      whiteSpace: 'pre-wrap', 
                      wordBreak: 'break-word',
                      color: '#e5e7eb',
                      fontSize: '0.9rem',
                      lineHeight: '1.5',
                      margin: 0
                    }}>
                      {response.data}
                    </pre>
                    <button 
                      onClick={() => navigator.clipboard.writeText(response.data)}
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.25rem 0.5rem',
                        background: '#374151',
                        border: '1px solid #4b5563',
                        borderRadius: '0.25rem',
                        color: '#e5e7eb',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      Copy
                    </button>
                  </div>
                )}
                
                {response.status === 'error' && (
                  <div className="error-message" style={{ 
                    background: '#7f1d1d', 
                    border: '1px solid #ef4444', 
                    padding: '1rem', 
                    borderRadius: '0.5rem',
                    marginTop: '1rem'
                  }}>
                    <p style={{ color: '#fca5a5' }}>{response.error || 'An error occurred'}</p>
                  </div>
                )}
                
                {response.status === 'pending' && (
                  <div style={{ 
                    color: '#f59e0b', 
                    fontStyle: 'italic',
                    padding: '1rem'
                  }}>
                    Waiting for response...
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Handle workflow execution results
  if (!workflowState) {
    return (
      <div className="results-container">
        <h2>No Results</h2>
        <p>No data to display.</p>
      </div>
    );
  }

  if (workflowState.isRunning) {
    return (
      <div className="results-container">
        <h2>Workflow in Progress...</h2>
        <p>View progress in the Workflow Builder tab.</p>
        {workflowState.steps && workflowState.steps.length > 0 && (
          <div className="progress-indicator">
            <h4>Steps:</h4>
            <ul>
              {workflowState.steps.map((step, index) => (
                <li key={step.id || index} className="step-item">
                  <span className="step-prompt">
                    {step.prompt ? step.prompt.substring(0, 50) + '...' : `Step ${index + 1}`}
                  </span>
                  <span className={`step-status ${
                    workflowState.results.has(step.id) ? 'completed' : 'pending'
                  }`}>
                    {workflowState.results.has(step.id) ? '✅ Done' : '⏳ Pending'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (workflowState.error) {
    return (
      <div className="results-container">
        <h3 style={{ color: '#ef4444' }}>Workflow Failed</h3>
        <div className="error-message" style={{ 
          background: '#7f1d1d', 
          border: '1px solid #ef4444', 
          padding: '1rem', 
          borderRadius: '0.5rem',
          marginTop: '1rem'
        }}>
          <p>{workflowState.error}</p>
        </div>
      </div>
    );
  }

  if (!workflowState.activeSessionId || workflowState.results.size === 0) {
    return (
      <div className="results-container">
        <h2>No Workflow Results</h2>
        <p>Run a workflow to see results here. Results will persist even when switching tabs.</p>
        <div className="empty-state" style={{
          textAlign: 'center',
          padding: '2rem',
          color: '#9ca3af',
          fontSize: '1.1rem'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
          <p>Your workflow results will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="results-container">
      <div className="results-header" style={{ marginBottom: '2rem' }}>
        <h2>Workflow Results</h2>
        <p style={{ color: '#9ca3af' }}>Session: {workflowState.activeSessionId}</p>
      </div>
      
      <div className="step-results">
        {Array.from(workflowState.results.entries()).map(([stepId, result]) => (
          <div key={stepId} className="result-item" style={{ 
            border: '1px solid #374151', 
            padding: '1.5rem', 
            margin: '1rem 0',
            borderRadius: '0.5rem',
            background: '#1f2937'
          }}>
            <h4 style={{ color: '#f3f4f6', marginBottom: '1rem' }}>Step: {stepId}</h4>
            <div className="result-content" style={{
              background: '#111827',
              padding: '1rem',
              borderRadius: '0.25rem',
              border: '1px solid #374151'
            }}>
              <pre style={{ 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-word',
                color: '#e5e7eb',
                fontSize: '0.9rem',
                lineHeight: '1.5',
                margin: 0
              }}>
                {typeof result === 'object' ? JSON.stringify(result, null, 2) : result}
              </pre>
            </div>
            <button 
              onClick={() => navigator.clipboard.writeText(
                typeof result === 'object' ? JSON.stringify(result, null, 2) : result
              )}
              style={{
                marginTop: '0.5rem',
                padding: '0.25rem 0.5rem',
                background: '#374151',
                border: '1px solid #4b5563',
                borderRadius: '0.25rem',
                color: '#e5e7eb',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              Copy
            </button>
          </div>
        ))}
      </div>
      
      {workflowState.finalSynthesis && (
        <div className="synthesis-result" style={{
          border: '2px solid #059669',
          padding: '1.5rem',
          margin: '2rem 0',
          borderRadius: '0.5rem',
          background: '#064e3b'
        }}>
          <h3 style={{ color: '#10b981', marginBottom: '1rem' }}>Final Synthesis</h3>
          <div className="synthesis-content" style={{
            background: '#111827',
            padding: '1rem',
            borderRadius: '0.25rem',
            border: '1px solid #374151'
          }}>
            <pre style={{ 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-word',
              color: '#e5e7eb',
              fontSize: '0.9rem',
              lineHeight: '1.5',
              margin: 0
            }}>
              {workflowState.finalSynthesis}
            </pre>
          </div>
          <button 
            onClick={() => navigator.clipboard.writeText(workflowState.finalSynthesis)}
            style={{
              marginTop: '0.5rem',
              padding: '0.5rem 1rem',
              background: '#059669',
              border: 'none',
              borderRadius: '0.25rem',
              color: 'white',
              fontSize: '0.9rem',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Copy Final Result
          </button>
        </div>
      )}
    </div>
  );
};