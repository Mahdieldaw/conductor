import React, { useState, useEffect } from 'react';
import { sidecarService } from '../services/SidecarService';
import './MemoryViewer.css';

interface WorkflowSession {
  sessionId: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  stepResults?: any[];
  error?: string;
  tabId: number;
  tabUrl?: string;
}

interface MemoryViewerProps {
  onSessionSelect?: (session: WorkflowSession) => void;
}

export const MemoryViewer: React.FC<MemoryViewerProps> = ({ onSessionSelect }) => {
  const [activeView, setActiveView] = useState<'hot' | 'history'>('hot');
  const [hotCache, setHotCache] = useState<WorkflowSession[]>([]);
  const [fullHistory, setFullHistory] = useState<WorkflowSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<WorkflowSession | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'startTime' | 'endTime' | 'workflowId'>('startTime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);



  useEffect(() => {
    if (activeView === 'hot') {
      loadHotCache();
    } else {
      loadFullHistory();
    }
  }, [activeView]);

  const loadHotCache = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await sidecarService.getHotCache();
      setHotCache(response.sessions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load hot cache');
    } finally {
      setLoading(false);
    }
  };

  const loadFullHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await sidecarService.getFullHistory({
        limit: 100,
        offset: (currentPage - 1) * itemsPerPage
      });
      setFullHistory(response.sessions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load full history');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentSessions = () => {
    const sessions = activeView === 'hot' ? hotCache : fullHistory;
    
    // Apply filters
    let filtered = sessions.filter(session => {
      const matchesSearch = searchTerm === '' || 
        session.workflowId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.sessionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (session.tabUrl && session.tabUrl.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (startTime: number, endTime?: number) => {
    if (!endTime) return 'Running...';
    const duration = endTime - startTime;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'running': return '🔄';
      default: return '❓';
    }
  };

  const handleSessionClick = (session: WorkflowSession) => {
    setSelectedSession(session);
    onSessionSelect?.(session);
  };

  const refreshData = () => {
    if (activeView === 'hot') {
      loadHotCache();
    } else {
      loadFullHistory();
    }
  };

  const currentSessions = getCurrentSessions();
  const totalPages = Math.ceil(currentSessions.length / itemsPerPage);
  const paginatedSessions = currentSessions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="memory-viewer">
      <div className="memory-header">
        <h2>Workflow Memory</h2>
        <div className="view-controls">
          <div className="view-tabs">
            <button 
              className={activeView === 'hot' ? 'active' : ''}
              onClick={() => setActiveView('hot')}
            >
              Hot Cache
            </button>
            <button 
              className={activeView === 'history' ? 'active' : ''}
              onClick={() => setActiveView('history')}
            >
              Full History
            </button>
          </div>
          <button onClick={refreshData} className="refresh-btn">
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="memory-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search workflows..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-controls">
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
          </select>
          
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="startTime">Start Time</option>
            <option value="endTime">End Time</option>
            <option value="workflowId">Workflow ID</option>
          </select>
          
          <button 
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="sort-order-btn"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <span>Loading workflow sessions...</span>
        </div>
      )}

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="sessions-list">
            {paginatedSessions.length === 0 ? (
              <div className="empty-state">
                <p>No workflow sessions found.</p>
                {activeView === 'hot' && (
                  <p>Recent workflow executions will appear here.</p>
                )}
              </div>
            ) : (
              paginatedSessions.map(session => (
                <div 
                  key={session.sessionId}
                  className={`session-item ${selectedSession?.sessionId === session.sessionId ? 'selected' : ''}`}
                  onClick={() => handleSessionClick(session)}
                >
                  <div className="session-header">
                    <div className="session-info">
                      <span className="status-icon">{getStatusIcon(session.status)}</span>
                      <span className="workflow-id">{session.workflowId}</span>
                      <span className="session-id">({session.sessionId.slice(0, 8)}...)</span>
                    </div>
                    <div className="session-meta">
                      <span className="timestamp">{formatTimestamp(session.startTime)}</span>
                      <span className="duration">{formatDuration(session.startTime, session.endTime)}</span>
                    </div>
                  </div>
                  
                  {session.tabUrl && (
                    <div className="session-url">
                      <span>🌐 {session.tabUrl}</span>
                    </div>
                  )}
                  
                  {session.error && (
                    <div className="session-error">
                      <span>❌ {session.error}</span>
                    </div>
                  )}
                  
                  {session.stepResults && (
                    <div className="session-steps">
                      <span>📝 {session.stepResults.length} steps completed</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button 
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              
              <span className="page-info">
                Page {currentPage} of {totalPages}
              </span>
              
              <button 
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {selectedSession && (
        <div className="session-details">
          <h3>Session Details</h3>
          <div className="details-content">
            <div className="detail-row">
              <strong>Session ID:</strong> {selectedSession.sessionId}
            </div>
            <div className="detail-row">
              <strong>Workflow ID:</strong> {selectedSession.workflowId}
            </div>
            <div className="detail-row">
              <strong>Status:</strong> 
              <span className={`status-badge ${selectedSession.status}`}>
                {getStatusIcon(selectedSession.status)} {selectedSession.status}
              </span>
            </div>
            <div className="detail-row">
              <strong>Started:</strong> {formatTimestamp(selectedSession.startTime)}
            </div>
            {selectedSession.endTime && (
              <div className="detail-row">
                <strong>Completed:</strong> {formatTimestamp(selectedSession.endTime)}
              </div>
            )}
            <div className="detail-row">
              <strong>Duration:</strong> {formatDuration(selectedSession.startTime, selectedSession.endTime)}
            </div>
            {selectedSession.tabUrl && (
              <div className="detail-row">
                <strong>Target URL:</strong> 
                <a href={selectedSession.tabUrl} target="_blank" rel="noopener noreferrer">
                  {selectedSession.tabUrl}
                </a>
              </div>
            )}
            
            {selectedSession.error && (
              <div className="detail-row error">
                <strong>Error:</strong> {selectedSession.error}
              </div>
            )}
            
            {selectedSession.stepResults && selectedSession.stepResults.length > 0 && (
              <div className="step-results">
                <strong>Step Results:</strong>
                {selectedSession.stepResults.map((result, index) => (
                  <div key={index} className="step-result">
                    <div className="step-header">Step {index + 1}</div>
                    <div className="step-content">
                      {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};