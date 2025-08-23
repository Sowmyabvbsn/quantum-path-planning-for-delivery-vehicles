import React, { useState } from 'react';
import InteractiveMap from './InteractiveMap';

function RouteDisplay({ route, stops }) {
  const [showDetails, setShowDetails] = useState(true);
  const [showAnimation, setShowAnimation] = useState(false);
  const [selectedStop, setSelectedStop] = useState(null);

  console.log('RouteDisplay - route:', route);
  console.log('RouteDisplay - stops:', stops);

  // Check if we have any route data at all
  if (!route) {
    return (
      <div className="route-display">
        <div className="card">
          <div className="empty-state">
            <span className="empty-icon">🗺️</span>
            <h3>No Route Optimized Yet</h3>
            <p>Run quantum optimization to see the optimal delivery route</p>
          </div>
        </div>
      </div>
    );
  }

  // Check if route has the expected structure
  if (!route.route || !Array.isArray(route.route) || route.route.length === 0) {
    return (
      <div className="route-display">
        <div className="card">
          <div className="empty-state">
            <span className="empty-icon">⚠️</span>
            <h3>Invalid Route Data</h3>
            <p>The optimization result doesn't contain valid route information</p>
          </div>
        </div>
      </div>
    );
  }

  // Get the route stops - use route.stops if available, otherwise map from main stops array
  let routeStops = [];
  
  if (route.stops && Array.isArray(route.stops) && route.stops.length > 0) {
    // Use the stops data directly from the route response
    routeStops = route.stops;
  } else {
    // Map route indices to actual stop data
    routeStops = route.route.map(stopIndex => {
      // Try to find stop by ID first
      let stop = stops.find(s => s.id === stopIndex);
      if (!stop) {
        // Try treating it as an array index
        stop = stops[stopIndex];
      }
      return stop;
    }).filter(Boolean); // Remove any undefined stops
  }

  console.log('RouteDisplay - routeStops:', routeStops);

  if (routeStops.length === 0) {
    return (
      <div className="route-display">
        <div className="card">
          <div className="empty-state">
            <span className="empty-icon">⚠️</span>
            <h3>No Valid Stops Found</h3>
            <p>Could not map the route to valid stop data</p>
            <div className="debug-info">
              <strong>Debug Info:</strong>
              <div>Route indices: {JSON.stringify(route.route)}</div>
              <div>Available stops: {stops.length}</div>
              <div>Route.stops exists: {route.stops ? 'Yes' : 'No'}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatDistance = (km) => {
    if (km < 1) {
      return `${(km * 1000).toFixed(0)} m`;
    }
    return `${km.toFixed(2)} km`;
  };

  const formatTime = (seconds) => {
    if (seconds < 1) {
      return `${(seconds * 1000).toFixed(0)} ms`;
    }
    return `${seconds.toFixed(3)} s`;
  };

  // Create route data structure for the map
  const mapRouteData = {
    route: routeStops.map(stop => stop.id),
    stops: routeStops,
    total_distance: route.total_distance,
    computation_time: route.computation_time,
    quantum_backend: route.quantum_backend,
    optimization_level: route.optimization_level
  };

  return (
    <div className="route-display">
      <div className="card">
        <div className="card-header">
          <div>
            <h2>🎯 Optimized Route</h2>
            <p>Quantum-optimized delivery path</p>
          </div>
          <div className="route-status">
            <span className="status-badge success">
              ✅ Optimization Complete
            </span>
          </div>
        </div>

        <div className="route-summary">
          <div className="summary-stats">
            <div className="stat-card">
              <div className="stat-value">{routeStops.length}</div>
              <div className="stat-label">Stops</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatDistance(route.total_distance || 0)}</div>
              <div className="stat-label">Total Distance</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatTime(route.computation_time || 0)}</div>
              <div className="stat-label">Compute Time</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{route.quantum_backend || 'Unknown'}</div>
              <div className="stat-label">Backend</div>
            </div>
          </div>
        </div>

        <div className="route-visualization">
          <div className="map-section">
            <div className="map-header">
              <h3>🗺️ Interactive Route Map</h3>
              <div className="map-controls">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAnimation(!showAnimation)}
                >
                  {showAnimation ? '⏸️ Stop Animation' : '▶️ Animate Route'}
                </button>
              </div>
            </div>
            
            <div className="map-container">
              <InteractiveMap
                stops={routeStops}
                route={mapRouteData}
                showAnimation={showAnimation}
                onAnimationComplete={() => setShowAnimation(false)}
                height="500px"
              />
            </div>
          </div>
          
          <div className="route-header">
            <h3>📋 Route Sequence</h3>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>

          <div className="route-path">
            {routeStops.map((stop, index) => (
              <div key={stop.id || index} className="route-step">
                <div className="step-connector">
                  <div className="step-number">{index + 1}</div>
                  {index < routeStops.length - 1 && (
                    <div className="connector-line">
                      <span className="arrow">↓</span>
                    </div>
                  )}
                </div>
                
                <div className="step-content">
                  <div className="stop-info">
                    <h4>{stop.name || `Stop ${index + 1}`}</h4>
                    {showDetails && (
                      <div className="stop-details">
                        <span className="coordinates">
                          📍 {parseFloat(stop.latitude || 0).toFixed(4)}, {parseFloat(stop.longitude || 0).toFixed(4)}
                        </span>
                        {index < routeStops.length - 1 && (
                          <span className="next-distance">
                            🚛 Next: {formatDistance(
                              calculateDistance(stop, routeStops[index + 1])
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {showDetails && (
          <div className="optimization-details">
            <h3>🔬 Quantum Optimization Details</h3>
            <div className="details-grid">
              <div className="detail-item">
                <strong>Algorithm:</strong>
                <span>QAOA (Quantum Approximate Optimization Algorithm)</span>
              </div>
              <div className="detail-item">
                <strong>Distance Calculation:</strong>
                <span>Haversine Formula</span>
              </div>
              <div className="detail-item">
                <strong>Route Type:</strong>
                <span>One-way Optimization</span>
              </div>
              <div className="detail-item">
                <strong>Optimization Level:</strong>
                <span>Level {route.optimization_level || 1}</span>
              </div>
              <div className="detail-item">
                <strong>Quantum Backend:</strong>
                <span>{route.quantum_backend || 'Unknown'}</span>
              </div>
              <div className="detail-item">
                <strong>Total Computation Time:</strong>
                <span>{formatTime(route.computation_time || 0)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="route-actions">
          <button
            className="btn btn-secondary"
            onClick={() => window.print()}
          >
            🖨️ Print Route
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              const routeData = {
                stops: routeStops,
                totalDistance: route.total_distance,
                optimizationTime: route.computation_time,
                backend: route.quantum_backend
              };
              
              const dataStr = JSON.stringify(routeData, null, 2);
              const dataBlob = new Blob([dataStr], {type: 'application/json'});
              
              const link = document.createElement('a');
              link.href = URL.createObjectURL(dataBlob);
              link.download = `quantum_route_${new Date().toISOString().split('T')[0]}.json`;
              link.click();
            }}
          >
            💾 Export Route
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper function to calculate distance between two stops
function calculateDistance(stop1, stop2) {
  if (!stop1 || !stop2 || !stop1.latitude || !stop1.longitude || !stop2.latitude || !stop2.longitude) {
    return 0;
  }
  
  const R = 6371; // Earth's radius in kilometers
  const dLat = (parseFloat(stop2.latitude) - parseFloat(stop1.latitude)) * Math.PI / 180;
  const dLon = (parseFloat(stop2.longitude) - parseFloat(stop1.longitude)) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(parseFloat(stop1.latitude) * Math.PI / 180) * Math.cos(parseFloat(stop2.latitude) * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default RouteDisplay;