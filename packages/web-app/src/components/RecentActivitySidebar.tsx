import React from 'react';

interface RecentActivityState {
  recentWorkflows: any[];
  recentPromptOutputs: Record<string, any[]>;
}

interface RecentActivitySidebarProps {
  activity: RecentActivityState;
  onUseOutput: (text: string) => void;
  onLoadWorkflow: (workflow: any) => void;
}

export const RecentActivitySidebar: React.FC<RecentActivitySidebarProps> = ({ 
  activity, 
  onUseOutput, 
  onLoadWorkflow 
}) => {
  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return 'Unknown';
    }
  };

  const truncateText = (text: string, maxLength: number = 40) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <aside style={{ 
      width: '320px', 
      borderRight: '1px solid #374151', 
      padding: '1rem', 
      overflowY: 'auto',
      background: '#111827',
      color: '#e5e7eb'
    }}>
      <h3 style={{ 
        marginBottom: '1.5rem', 
        color: '#f3f4f6',
        fontSize: '1.2rem',
        fontWeight: 'bold'
      }}>
        Recent Activity
      </h3>
      
      {/* Recent Prompt Outputs */}
      <div style={{ marginBottom: '2rem' }}>
        <h4 style={{ 
          marginBottom: '1rem', 
          color: '#9ca3af',
          fontSize: '1rem',
          fontWeight: '600'
        }}>
          Recent Prompts
        </h4>
        
        {Object.keys(activity.recentPromptOutputs).length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.9rem', fontStyle: 'italic' }}>
            No recent prompts
          </p>
        ) : (
          Object.entries(activity.recentPromptOutputs).map(([provider, outputs]) => (
            <div key={provider} style={{ marginBottom: '1rem' }}>
              <h5 style={{ 
                color: '#d1d5db', 
                fontSize: '0.9rem', 
                fontWeight: '500',
                marginBottom: '0.5rem',
                textTransform: 'capitalize'
              }}>
                {provider}
              </h5>
              
              {outputs.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                  No outputs
                </p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {outputs.slice(0, 3).map(output => (
                    <li key={output.id} style={{ 
                      marginBottom: '0.75rem',
                      padding: '0.75rem',
                      background: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '0.375rem'
                    }}>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <p style={{ 
                          fontSize: '0.8rem', 
                          color: '#9ca3af',
                          margin: 0,
                          fontWeight: '500'
                        }}>
                          Prompt:
                        </p>
                        <p style={{ 
                          fontSize: '0.8rem', 
                          color: '#d1d5db',
                          margin: '0.25rem 0 0 0',
                          lineHeight: '1.3'
                        }}>
                          {truncateText(output.prompt)}
                        </p>
                      </div>
                      
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginTop: '0.5rem'
                      }}>
                        <span style={{ 
                          fontSize: '0.7rem', 
                          color: '#6b7280'
                        }}>
                          {formatTimestamp(output.timestamp)}
                        </span>
                        <button 
                          onClick={() => onUseOutput(output.response)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: '#3b82f6',
                            border: 'none',
                            borderRadius: '0.25rem',
                            color: 'white',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                          onMouseOver={(e) => (e.target as HTMLButtonElement).style.background = '#2563eb'}
                          onMouseOut={(e) => (e.target as HTMLButtonElement).style.background = '#3b82f6'}
                        >
                          Use Output
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </div>

      <hr style={{ 
        margin: '1.5rem 0', 
        border: 'none', 
        borderTop: '1px solid #374151' 
      }} />

      {/* Recent Workflows */}
      <div>
        <h4 style={{ 
          marginBottom: '1rem', 
          color: '#9ca3af',
          fontSize: '1rem',
          fontWeight: '600'
        }}>
          Recent Workflows
        </h4>
        
        {activity.recentWorkflows.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.9rem', fontStyle: 'italic' }}>
            No recent workflows
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {activity.recentWorkflows.slice(0, 5).map(workflow => (
              <li key={workflow.sessionId} style={{ 
                marginBottom: '0.75rem',
                padding: '0.75rem',
                background: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '0.375rem'
              }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <p style={{ 
                    fontSize: '0.9rem', 
                    color: '#f3f4f6',
                    margin: 0,
                    fontWeight: '500'
                  }}>
                    {workflow.name || 'Unnamed Workflow'}
                  </p>
                  <p style={{ 
                    fontSize: '0.7rem', 
                    color: '#9ca3af',
                    margin: '0.25rem 0 0 0'
                  }}>
                    {workflow.steps?.length || 0} steps • {formatTimestamp(workflow.timestamp || workflow.startTime)}
                  </p>
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  gap: '0.5rem',
                  marginTop: '0.5rem'
                }}>
                  <button 
                    onClick={() => onLoadWorkflow(workflow)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: '#059669',
                      border: 'none',
                      borderRadius: '0.25rem',
                      color: 'white',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      fontWeight: '500',
                      flex: 1
                    }}
                    onMouseOver={(e) => (e.target as HTMLButtonElement).style.background = '#047857'}
                    onMouseOut={(e) => (e.target as HTMLButtonElement).style.background = '#059669'}
                  >
                    Load Results
                  </button>
                  
                  {workflow.finalSynthesis && (
                    <button 
                      onClick={() => onUseOutput(workflow.finalSynthesis)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        background: '#7c3aed',
                        border: 'none',
                        borderRadius: '0.25rem',
                        color: 'white',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                      onMouseOver={(e) => (e.target as HTMLButtonElement).style.background = '#6d28d9'}
                      onMouseOut={(e) => (e.target as HTMLButtonElement).style.background = '#7c3aed'}
                    >
                      Use Final
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
};