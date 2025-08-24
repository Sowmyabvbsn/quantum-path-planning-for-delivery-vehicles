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
            <span className="stat">
              <strong>{stops.length}</strong> Total
            </span>
            <span className="stat selected">
              <strong>{selectedStops.length}</strong> Selected
            </span>
          </div>
        </div>

        {stops.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📍</span>
            <h3>No stops added yet</h3>
            <p>Add stops manually or upload a CSV file to get started</p>
          </div>
        ) : (
          <>
            <div className="list-controls">
              <button
                className="btn btn-secondary"
                onClick={handleSelectAll}
              >
                {selectedStops.length === stops.length ? 'Deselect All' : 'Select All'}
              </button>
              
              <div className="selection-info">
                {selectedStops.length > 0 && (
                  <span className="selection-count">
                    {selectedStops.length} of {stops.length} selected
                  </span>
                )}
              </div>
            </div>

            <div className="stops-table" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table>
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Name</th>
                    <th>Latitude</th>
                    <th>Longitude</th>
                    <th>Added</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stops.map((stop) => (
                    <tr 
                      key={stop.id}
                      className={selectedStops.includes(stop.id) ? 'selected' : ''}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedStops.includes(stop.id)}
                          onChange={(e) => onStopSelection(stop.id, e.target.checked)}
                          className="stop-checkbox"
                          style={{ touchAction: 'manipulation' }}
                        />
                      </td>
                      <td>
                        <div className="stop-name">
                          <span className="stop-icon">📍</span>
                          {stop.name}
                        </div>
                      </td>
                      <td className="coordinate">
                        {formatCoordinate(stop.latitude)}
                      </td>
                      <td className="coordinate">
                        {formatCoordinate(stop.longitude)}
                      </td>
                      <td className="date">
                        {formatDate(stop.created_at)}
                      </td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => onStopDeleted(stop.id)}
                          title="Delete stop"
                          style={{ touchAction: 'manipulation' }}
                        >
                          🗑️
                        </button>
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
        <div className="selection-summary">
          <div className="summary-card">
            <h3>✅ Ready for Optimization</h3>
            <p>
              {selectedStops.length} stops selected. 
              Switch to the Quantum Optimization tab to find the optimal route.
            </p>
          </div>
        </div>
      )}

      {selectedStops.length === 1 && (
        <div className="selection-warning">
          <div className="warning-card">
            <h3>⚠️ More Stops Needed</h3>
            <p>
              Select at least 2 stops to perform route optimization.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default StopsList;