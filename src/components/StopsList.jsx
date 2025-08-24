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
    <div className="stops-list">
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Manage Stops</h2>
            <p>Select stops for quantum optimization</p>
          </div>
          <div className="stops-stats">
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleSelectAll}
                >
                  <span>{selectedStops.length === stops.length ? '❌' : '✅'}</span>
                  {selectedStops.length === stops.length ? 'Deselect All' : 'Select All'}
                </button>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
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

            <div className="stops-table" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Select</th>
                    <th>Stop Details</th>
                    <th>Coordinates</th>
                    <th>Date Added</th>
                    <th style={{ width: '80px' }}>Actions</th>
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
                            width: '40px', 
                            height: '40px', 
                            background: selectedStops.includes(stop.id) ? '#667eea' : '#64748b',
                            borderRadius: '50%', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '1.125rem',
                            flexShrink: 0
                          }}>
                            📍
                          </div>
                          <div>
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
                        <div style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: '#6b7280' }}>
                          <div>📍 {formatCoordinate(stop.latitude)}</div>
                          <div style={{ marginTop: '0.25rem' }}>🌐 {formatCoordinate(stop.longitude)}</div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
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
                              padding: '0.5rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
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
            padding: '2rem',
            textAlign: 'center',
            color: '#065f46'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚀</div>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem', fontWeight: '700' }}>
              Ready for Quantum Optimization!
            </h3>
            <p>
              <strong>{selectedStops.length} stops</strong> selected and ready for processing. 
              Switch to the <strong>Quantum Optimization</strong> tab to calculate the most efficient delivery route.
            </p>
            <div style={{ marginTop: '1.5rem' }}>
              <div className="btn btn-primary" style={{ display: 'inline-flex', pointerEvents: 'none', opacity: 0.8 }}>
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
            padding: '2rem',
            textAlign: 'center',
            color: '#92400e'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '700' }}>
              More Stops Needed
            </h3>
            <p>
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