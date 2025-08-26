import React, { useState, useEffect } from 'react';
import obstacleService from '../services/obstacleService';

function ObstaclePanel({ 
  obstacles = [], 
  onObstacleClick = null, 
  onRefresh = null,
  loading = false,
  className = ''
}) {
  const [selectedObstacle, setSelectedObstacle] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('priority');
  const [showDetails, setShowDetails] = useState(false);

  // Filter and sort obstacles
  const filteredObstacles = obstacles
    .filter(obstacle => {
      if (filterSeverity !== 'all' && obstacle.severity !== filterSeverity) return false;
      if (filterType !== 'all' && obstacle.type !== filterType) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return (b.priority || 0) - (a.priority || 0);
        case 'severity':
          const severityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
          return severityOrder[b.severity] - severityOrder[a.severity];
        case 'distance':
          return (a.distance || 0) - (b.distance || 0);
        case 'time':
          return new Date(b.timestamp) - new Date(a.timestamp);
        default:
          return 0;
      }
    });

  // Get unique obstacle types for filter
  const obstacleTypes = [...new Set(obstacles.map(o => o.type))];

  const getSeverityColor = (severity) => {
    const colors = {
      'High': '#ef4444',
      'Medium': '#f59e0b',
      'Low': '#10b981'
    };
    return colors[severity] || '#64748b';
  };

  const getSeverityBadge = (severity) => {
    const badges = {
      'High': '🚨',
      'Medium': '⚠️',
      'Low': '💡'
    };
    return badges[severity] || '📍';
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return time.toLocaleDateString();
  };

  const handleObstacleClick = (obstacle) => {
    setSelectedObstacle(obstacle);
    if (onObstacleClick) {
      onObstacleClick(obstacle);
    }
  };

  return (
    <div className={`obstacle-panel ${className}`} style={{
      background: 'rgba(255, 255, 255, 0.98)',
      borderRadius: '16px',
      border: '1px solid rgba(226, 232, 240, 0.5)',
      overflow: 'hidden',
      maxHeight: '600px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '1.5rem',
        borderBottom: '1px solid rgba(226, 232, 240, 0.3)',
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.02) 0%, rgba(118, 75, 162, 0.02) 100%)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: '700' }}>
              🚧 Live Obstacles
            </h3>
            <p style={{ margin: '0', fontSize: '0.875rem', color: '#64748b' }}>
              {filteredObstacles.length} of {obstacles.length} obstacles
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {onRefresh && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={onRefresh}
                disabled={loading}
                style={{ minWidth: '80px' }}
              >
                {loading ? (
                  <>
                    <span className="spinner" style={{ width: '12px', height: '12px' }}></span>
                    Updating
                  </>
                ) : (
                  <>
                    🔄 Refresh
                  </>
                )}
              </button>
            )}
            
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? '👁️‍🗨️ Hide' : '👁️ Details'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : 'repeat(3, 1fr)',
          gap: '1rem',
          marginTop: '1rem'
        }}>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            style={{
              padding: '0.5rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '0.875rem'
            }}
          >
            <option value="all">All Severities</option>
            <option value="High">🚨 High</option>
            <option value="Medium">⚠️ Medium</option>
            <option value="Low">💡 Low</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              padding: '0.5rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '0.875rem'
            }}
          >
            <option value="all">All Types</option>
            {obstacleTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '0.5rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '0.875rem'
            }}
          >
            <option value="priority">Sort by Priority</option>
            <option value="severity">Sort by Severity</option>
            <option value="distance">Sort by Distance</option>
            <option value="time">Sort by Time</option>
          </select>
        </div>
      </div>

      {/* Obstacle List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1rem'
      }}>
        {filteredObstacles.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            color: '#64748b'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h4>No obstacles found</h4>
            <p>All clear on your route!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredObstacles.map((obstacle, index) => (
              <div
                key={obstacle.id || index}
                onClick={() => handleObstacleClick(obstacle)}
                style={{
                  padding: '1rem',
                  background: selectedObstacle?.id === obstacle.id 
                    ? 'rgba(102, 126, 234, 0.1)' 
                    : 'rgba(248, 250, 252, 0.8)',
                  borderRadius: '12px',
                  border: `2px solid ${selectedObstacle?.id === obstacle.id 
                    ? '#667eea' 
                    : 'rgba(226, 232, 240, 0.5)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (selectedObstacle?.id !== obstacle.id) {
                    e.target.style.background = 'rgba(248, 250, 252, 1)';
                    e.target.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedObstacle?.id !== obstacle.id) {
                    e.target.style.background = 'rgba(248, 250, 252, 0.8)';
                    e.target.style.transform = 'translateY(0)';
                  }
                }}
              >
                {/* Priority indicator */}
                {obstacle.priority && obstacle.priority > 2 && (
                  <div style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '0.5rem',
                    background: '#ef4444',
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    HIGH PRIORITY
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem'
                }}>
                  <div style={{
                    fontSize: '1.5rem',
                    flexShrink: 0
                  }}>
                    {obstacle.icon || '⚠️'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.5rem',
                      flexWrap: 'wrap'
                    }}>
                      <h4 style={{
                        margin: 0,
                        fontSize: '1rem',
                        fontWeight: '600',
                        color: '#1e293b'
                      }}>
                        {obstacle.type}
                      </h4>
                      
                      <span style={{
                        background: getSeverityColor(obstacle.severity),
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}>
                        {getSeverityBadge(obstacle.severity)}
                        {obstacle.severity}
                      </span>
                    </div>

                    <p style={{
                      margin: '0 0 0.75rem 0',
                      fontSize: '0.875rem',
                      color: '#64748b',
                      lineHeight: '1.4'
                    }}>
                      {obstacle.description}
                    </p>

                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      fontSize: '0.75rem',
                      color: '#9ca3af'
                    }}>
                      {obstacle.duration && (
                        <span>⏱️ {obstacle.duration}</span>
                      )}
                      <span>📍 {formatTimeAgo(obstacle.timestamp)}</span>
                      <span>📡 {obstacle.source}</span>
                      {obstacle.metadata?.simulated && (
                        <span style={{ color: '#f59e0b' }}>🎭 Simulated</span>
                      )}
                    </div>

                    {showDetails && obstacle.metadata && (
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        background: 'rgba(248, 250, 252, 0.8)',
                        borderRadius: '8px',
                        fontSize: '0.75rem'
                      }}>
                        <strong>Additional Details:</strong>
                        <div style={{ marginTop: '0.5rem' }}>
                          {Object.entries(obstacle.metadata)
                            .filter(([key]) => !['simulated', 'confidence'].includes(key))
                            .map(([key, value]) => (
                              <div key={key} style={{ marginBottom: '0.25rem' }}>
                                <span style={{ textTransform: 'capitalize' }}>
                                  {key.replace(/([A-Z])/g, ' $1')}: 
                                </span>
                                <span style={{ marginLeft: '0.5rem', fontWeight: '500' }}>
                                  {typeof value === 'number' ? value.toFixed(2) : value}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div style={{
        padding: '1rem 1.5rem',
        borderTop: '1px solid rgba(226, 232, 240, 0.3)',
        background: 'rgba(248, 250, 252, 0.5)'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
          textAlign: 'center'
        }}>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ef4444' }}>
              {obstacles.filter(o => o.severity === 'High').length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>High Risk</div>
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#f59e0b' }}>
              {obstacles.filter(o => o.severity === 'Medium').length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Medium Risk</div>
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>
              {obstacles.filter(o => o.severity === 'Low').length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Low Risk</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ObstaclePanel;