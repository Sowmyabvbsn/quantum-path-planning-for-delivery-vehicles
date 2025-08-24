import React from 'react';

function StopsList({ stops, selectedStops, onStopSelection, onStopDeleted }) {
  const handleSelectAll = () => {
    if (selectedStops.length === stops.length) {
      // Deselect all
      stops.forEach(stop => onStopSelection(stop.id, false));
    } else {
      // Select all
      stops.forEach(stop => {
        if (!selectedStops.includes(stop.id)) {
          onStopSelection(stop.id, true);
        }
      });
    }
  };

  const formatCoordinate = (coord, decimals = 4) => {
    return parseFloat(coord).toFixed(decimals);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="stops-list w-full box-border">
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Manage Stops</h2>
            <p>Select stops for quantum optimization</p>
          </div>
          <div className="stops-stats" style={{
            display: 'grid',
            gridTemplateColumns: window.innerWidth <= 768 ? '1fr 1fr' : 'repeat(2, 1fr)',
            gap: '1rem',
            minWidth: window.innerWidth <= 768 ? '200px' : 'auto'
          }}>
            <div className="stat-card">
              <div className="stat-value">{stops.length}</div>
              <div className="stat-label">Total Stops</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#667eea' }}>{selectedStops.length}</div>
              <div className="stat-label">Selected</div>
            </div>
          </div>
        </div>

        {stops.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📍</span>
            <h3>No stops added yet</h3>
            <p>Add stops manually or upload a CSV file to get started</p>
            <div style={{ marginTop: '2rem' }}>
              <div className="btn btn-primary" style={{ display: 'inline-flex', pointerEvents: 'none', opacity: 0.7 }}>
                <span>📍</span>
                Add Your First Stop
              </div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(226, 232, 240, 0.5)', background: 'rgba(248, 250, 252, 0.5)' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                flexWrap: 'wrap', 
                gap: '1rem',
                width: '100%'
              }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleSelectAll}
                  style={{
                    flex: window.innerWidth <= 768 ? '1 1 100%' : '0 1 auto'
                  }}
                >
                  <span>{selectedStops.length === stops.length ? '❌' : '✅'}</span>
                  {selectedStops.length === stops.length ? 'Deselect All' : 'Select All'}
                </button>
                
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem', 
                  flexWrap: 'wrap',
                  justifyContent: window.innerWidth <= 768 ? 'center' : 'flex-end',
                  width: window.innerWidth <= 768 ? '100%' : 'auto'
                }}>
                  {selectedStops.length > 0 && (
                    <div style={{ 
                      background: 'rgba(102, 126, 234, 0.1)', 
                      color: '#667eea', 
                      padding: '0.5rem 1rem', 
                      borderRadius: '20px', 
                      fontSize: '0.875rem', 
                      fontWeight: '600',
                      border: '1px solid rgba(102, 126, 234, 0.2)'
                    }}>
                      ✨ {selectedStops.length} of {stops.length} selected
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="stops-table w-full box-border" style={{ 
              overflowX: 'auto', 
              WebkitOverflowScrolling: 'touch',
              width: '100%'
            }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: window.innerWidth <= 768 ? '50px' : '60px' }}>Select</th>
                    <th>Stop Details</th>
                    <th style={{ minWidth: '120px' }}>Coordinates</th>
                    <th style={{ minWidth: '100px' }}>Date Added</th>
                    <th style={{ width: window.innerWidth <= 768 ? '60px' : '80px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stops.map((stop) => (
                    <tr 
                      key={stop.id}
                      className={selectedStops.includes(stop.id) ? 'selected' : ''}
                      style={{ 
                        background: selectedStops.includes(stop.id) 
                          ? 'rgba(102, 126, 234, 0.05)' 
                          : 'transparent',
                        borderLeft: selectedStops.includes(stop.id) 
                          ? '4px solid #667eea' 
                          : '4px solid transparent'
                      }}
                    >
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedStops.includes(stop.id)}
                            onChange={(e) => onStopSelection(stop.id, e.target.checked)}
                            style={{ 
                              width: '20px', 
                              height: '20px', 
                              cursor: 'pointer',
                              accentColor: '#667eea'
                            }}
                          />
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ 
                            width: window.innerWidth <= 768 ? '32px' : '40px', 
                            height: window.innerWidth <= 768 ? '32px' : '40px', 
                            background: selectedStops.includes(stop.id) ? '#667eea' : '#64748b',
                            borderRadius: '50%', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: window.innerWidth <= 768 ? '1rem' : '1.125rem',
                            flexShrink: 0
                          }}>
                            📍
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: '600', color: '#1e293b', marginBottom: '0.25rem' }}>
                              {stop.name}
                            </div>
                            {selectedStops.includes(stop.id) && (
                              <div style={{ 
                                fontSize: '0.75rem', 
                                color: '#667eea', 
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}>
                                ✨ Selected for optimization
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ 
                          fontFamily: 'monospace', 
                          fontSize: window.innerWidth <= 768 ? '0.75rem' : '0.8125rem', 
                          color: '#6b7280',
                          wordBreak: 'break-all'
                        }}>
                          <div>📍 {formatCoordinate(stop.latitude)}</div>
                          <div style={{ marginTop: '0.25rem' }}>🌐 {formatCoordinate(stop.longitude)}</div>
                        </div>
                      </td>
                      <td>
                        <div style={{ 
                          fontSize: window.innerWidth <= 768 ? '0.75rem' : '0.8125rem', 
                          color: '#64748b'
                        }}>
                          {formatDate(stop.created_at)}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => onStopDeleted(stop.id)}
                            title="Delete stop"
                            style={{ 
                              minWidth: '40px',
                              padding: window.innerWidth <= 768 ? '0.375rem' : '0.5rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: window.innerWidth <= 768 ? '0.875rem' : '1rem'
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {selectedStops.length >= 2 && (
        <div style={{ animation: 'fadeInUp 0.5s ease-out' }}>
          <div style={{
            background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
            border: '2px solid #10b981',
            borderRadius: '20px',
            padding: window.innerWidth <= 768 ? '1.5rem' : '2rem',
            textAlign: 'center',
            color: '#065f46',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div style={{ 
              fontSize: window.innerWidth <= 768 ? '2.5rem' : '3rem', 
              marginBottom: '1rem' 
            }}>🚀</div>
            <h3 style={{ 
              margin: '0 0 1rem 0', 
              fontSize: window.innerWidth <= 768 ? '1.25rem' : '1.5rem', 
              fontWeight: '700' 
            }}>
              Ready for Quantum Optimization!
            </h3>
            <p style={{ 
              fontSize: window.innerWidth <= 768 ? '0.875rem' : '1rem',
              lineHeight: '1.5'
            }}>
              <strong>{selectedStops.length} stops</strong> selected and ready for processing. 
              Switch to the <strong>Quantum Optimization</strong> tab to calculate the most efficient delivery route.
            </p>
            <div style={{ marginTop: '1.5rem' }}>
              <div className="btn btn-primary" style={{ 
                display: 'inline-flex', 
                pointerEvents: 'none', 
                opacity: 0.8,
                fontSize: window.innerWidth <= 768 ? '0.875rem' : '1rem'
              }}>
                <span>⚛️</span>
                Start Optimization
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedStops.length === 1 && (
        <div style={{ animation: 'fadeInUp 0.5s ease-out' }}>
          <div style={{
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            border: '2px solid #f59e0b',
            borderRadius: '20px',
            padding: window.innerWidth <= 768 ? '1.5rem' : '2rem',
            textAlign: 'center',
            color: '#92400e',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div style={{ 
              fontSize: window.innerWidth <= 768 ? '2.5rem' : '3rem', 
              marginBottom: '1rem' 
            }}>⚠️</div>
            <h3 style={{ 
              margin: '0 0 1rem 0', 
              fontSize: window.innerWidth <= 768 ? '1.125rem' : '1.25rem', 
              fontWeight: '700' 
            }}>
              More Stops Needed
            </h3>
            <p style={{ 
              fontSize: window.innerWidth <= 768 ? '0.875rem' : '1rem',
              lineHeight: '1.5'
            }}>
              You need to select at least <strong>2 stops</strong> to perform route optimization. 
              Please select one more stop to continue.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default StopsList;