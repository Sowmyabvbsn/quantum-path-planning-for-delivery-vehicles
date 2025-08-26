import React, { useState } from 'react';
import InteractiveMap from './InteractiveMap';
import ObstaclePanel from './ObstaclePanel';
import obstacleService from '../services/obstacleService';

function RouteDisplay({ route, stops }) {
  const [showDetails, setShowDetails] = useState(true);
  const [showAnimation, setShowAnimation] = useState(false);
  const [selectedStop, setSelectedStop] = useState(null);
  const [obstacles, setObstacles] = useState([]);
  const [loadingObstacles, setLoadingObstacles] = useState(false);
  const [showObstacles, setShowObstacles] = useState(true);

  // Fetch obstacles for the optimized route
  React.useEffect(() => {
    if (route && route.route && routeStops.length > 0) {
      fetchRouteObstacles();
    }
  }, [route]);

  const fetchRouteObstacles = async () => {
    setLoadingObstacles(true);
    try {
      const coordinates = routeStops.map(stop => [
        parseFloat(stop.latitude),
        parseFloat(stop.longitude)
      ]);
      
      const routeObstacles = await obstacleService.getRouteObstacles(coordinates, {
        includeWeather: true,
        includeTraffic: true,
        includeConstruction: true,
        includeEvents: true,
        maxObstacles: 20
      });
      
      setObstacles(routeObstacles);
    } catch (error) {
      console.error('Error fetching route obstacles:', error);
      setObstacles([]);
    } finally {
      setLoadingObstacles(false);
    }
  };

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
    <div className="route-display w-full box-border">
      <div className="card">
        <div className="card-header">
          <div>
            <h2>🎯 Optimized Route</h2>
            <p>Quantum-optimized delivery path</p>
          </div>
          <div className="route-status" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap'
          }}>
            <span className="status-badge success">
              ✅ Optimization Complete
            </span>
            {obstacles.length > 0 && (
              <span className="status-badge warning" style={{
                background: obstacles.some(o => o.severity === 'High') 
                  ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                  : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                fontSize: '0.875rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                {obstacles.some(o => o.severity === 'High') ? '🚨' : '⚠️'}
                {obstacles.length} Obstacles Detected
              </span>
            )}
          </div>
        </div>

        <div className="route-summary w-full box-border">
          <div className="summary-stats w-full box-border">
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

        <div className="route-visualization w-full box-border">
          {/* Obstacle Analysis Section */}
          {obstacles.length > 0 && (
            <div className="obstacle-analysis w-full box-border" style={{ marginBottom: '2rem' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <h3>🚧 Route Obstacle Analysis</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={fetchRouteObstacles}
                    disabled={loadingObstacles}
                  >
                    {loadingObstacles ? (
                      <>
                        <span className="spinner" style={{ width: '12px', height: '12px' }}></span>
                        Updating
                      </>
                    ) : (
                      <>🔄 Refresh</>
                    )}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowObstacles(!showObstacles)}
                  >
                    {showObstacles ? '🙈 Hide' : '👁️ Show'} Obstacles
                  </button>
                </div>
              </div>
              
              {showObstacles && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : '2fr 1fr',
                  gap: '1.5rem'
                }}>
                  <div>
                    <ObstaclePanel
                      obstacles={obstacles}
                      loading={loadingObstacles}
                      onRefresh={fetchRouteObstacles}
                      onObstacleClick={(obstacle) => {
                        console.log('Obstacle clicked:', obstacle);
                        // Could zoom map to obstacle location
                      }}
                    />
                  </div>
                  
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.98)',
                    borderRadius: '16px',
                    border: '1px solid rgba(226, 232, 240, 0.5)',
                    padding: '1.5rem'
                  }}>
                    <h4 style={{ margin: '0 0 1rem 0' }}>🎯 Impact Assessment</h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{
                        padding: '1rem',
                        background: obstacles.some(o => o.severity === 'High') 
                          ? 'rgba(239, 68, 68, 0.1)' 
                          : 'rgba(245, 158, 11, 0.1)',
                        borderRadius: '12px',
                        border: `1px solid ${obstacles.some(o => o.severity === 'High') 
                          ? 'rgba(239, 68, 68, 0.2)' 
                          : 'rgba(245, 158, 11, 0.2)'}`
                      }}>
                        <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                          Route Risk Level: {obstacles.some(o => o.severity === 'High') ? '🚨 HIGH' : '⚠️ MODERATE'}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                          {obstacles.some(o => o.severity === 'High') 
                            ? 'Consider alternative routes or delay departure'
                            : 'Proceed with caution and monitor conditions'
                          }
                        </div>
                      </div>
                      
                      <div style={{
                        padding: '1rem',
                        background: 'rgba(102, 126, 234, 0.05)',
                        borderRadius: '12px',
                        border: '1px solid rgba(102, 126, 234, 0.1)'
                      }}>
                        <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                          📊 Obstacle Breakdown
                        </div>
                        <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div>🚨 High Risk: {obstacles.filter(o => o.severity === 'High').length}</div>
                          <div>⚠️ Medium Risk: {obstacles.filter(o => o.severity === 'Medium').length}</div>
                          <div>💡 Low Risk: {obstacles.filter(o => o.severity === 'Low').length}</div>
                        </div>
                      </div>
                      
                      <div style={{
                        padding: '1rem',
                        background: 'rgba(16, 185, 129, 0.05)',
                        borderRadius: '12px',
                        border: '1px solid rgba(16, 185, 129, 0.1)'
                      }}>
                        <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                          🔄 Real-time Updates
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                          Obstacle data refreshes every 5 minutes automatically. 
                          Click refresh for immediate updates.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="map-section w-full box-border">
            <div className="map-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              <h3>🗺️ Interactive Route Map</h3>
              <div className="map-controls" style={{
                display: 'flex',
                gap: '0.5rem'
              }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAnimation(!showAnimation)}
                  style={{ touchAction: 'manipulation' }}
                >
                  {showAnimation ? '⏸️ Stop Animation' : '▶️ Animate Route'}
                </button>
              </div>
            </div>
            
            <div className="map-container w-full box-border">
              <InteractiveMap
                stops={routeStops}
                route={mapRouteData}
                obstacles={obstacles}
                showAnimation={showAnimation}
                onAnimationComplete={() => setShowAnimation(false)}
                height={window.innerWidth <= 768 ? "400px" : "500px"}
              />
            </div>
          </div>
          
          <div className="route-header" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            margin: '2rem 0 1rem 0'
          }}>
            <h3>📋 Route Sequence</h3>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowDetails(!showDetails)}
              style={{ touchAction: 'manipulation' }}
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>

          <div className="route-path w-full box-border">
            {routeStops.map((stop, index) => (
              <div key={stop.id || index} className="route-step w-full box-border">
                <div className="step-connector" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flexShrink: 0
                }}>
                  <div className="step-number">{index + 1}</div>
                  {index < routeStops.length - 1 && (
                    <div className="connector-line" style={{
                      height: '30px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#cbd5e0',
                      fontSize: '1.25rem'
                    }}>
                      <span className="arrow">↓</span>
                    </div>
                  )}
                </div>
                
                <div className="step-content" style={{
                  flex: 1,
                  minWidth: 0
                }}>
                  <div className="stop-info w-full box-border">
                    <h4>{stop.name || `Stop ${index + 1}`}</h4>
                    {showDetails && (
                      <div className="stop-details" style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem'
                      }}>
                        <span className="coordinates" style={{
                          fontSize: '0.75rem',
                          color: '#64748b'
                        }}>
                          📍 {parseFloat(stop.latitude || 0).toFixed(4)}, {parseFloat(stop.longitude || 0).toFixed(4)}
                        </span>
                        {index < routeStops.length - 1 && (
                          <span className="next-distance" style={{
                            fontSize: '0.75rem',
                            color: '#64748b'
                          }}>
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
          <div className="optimization-details w-full box-border" style={{
            padding: '2rem',
            background: 'rgba(248, 250, 252, 0.8)',
            borderRadius: '16px',
            margin: '2rem 0'
          }}>
            <h3>🔬 Quantum Optimization Details</h3>
            <div className="details-grid" style={{
              display: 'grid',
              gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem',
              marginTop: '1rem'
            }}>
              <div className="detail-item" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}>
                <strong>Algorithm:</strong>
                <span>QAOA (Quantum Approximate Optimization Algorithm)</span>
              </div>
              <div className="detail-item" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}>
                <strong>Distance Calculation:</strong>
                <span>Haversine Formula</span>
              </div>
              <div className="detail-item" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}>
                <strong>Route Type:</strong>
                <span>One-way Optimization</span>
              </div>
              <div className="detail-item" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}>
                <strong>Optimization Level:</strong>
                <span>Level {route.optimization_level || 1}</span>
              </div>
              <div className="detail-item" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}>
                <strong>Quantum Backend:</strong>
                <span>{route.quantum_backend || 'Unknown'}</span>
              </div>
              {obstacles.length > 0 && (
                <div className="detail-item" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}>
                  <strong>Route Obstacles:</strong>
                  <span>{obstacles.length} detected ({obstacles.filter(o => o.severity === 'High').length} high risk)</span>
                </div>
              )}
              <div className="detail-item" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}>
                <strong>Total Computation Time:</strong>
                <span>{formatTime(route.computation_time || 0)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="route-actions" style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          flexWrap: 'wrap',
          padding: '2rem'
        }}>
          <button
            className="btn btn-secondary" 
            onClick={() => window.print()}
            style={{
              flex: window.innerWidth <= 768 ? '1 1 100%' : '0 1 auto',
              minWidth: '150px'
            }}
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
            style={{
              flex: window.innerWidth <= 768 ? '1 1 100%' : '0 1 auto',
              minWidth: '150px'
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