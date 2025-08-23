import React, { useState, useMemo } from 'react';
import { optimizeRoute } from '../services/api';
import InteractiveMap from './InteractiveMap';

function QuantumDashboard({ selectedStops, stops, onOptimizationComplete, loading, setLoading }) {
  const [optimizationParams, setOptimizationParams] = useState({
    start_index: 0,
    quantum_backend: 'qasm_simulator',
    optimization_level: 1
  });
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [previewRoute, setPreviewRoute] = useState(null);
  const [message, setMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);

  // Filter selected stops and ensure we have valid data
  const selectedStopData = useMemo(() => {
    if (!Array.isArray(selectedStops) || !Array.isArray(stops)) {
      return [];
    }
    
    if (selectedStops.length === 0 || stops.length === 0) {
      return [];
    }
    
    const filtered = stops.filter(stop => {
      const isSelected = selectedStops.includes(stop.id);
      const hasValidData = stop && stop.id && stop.name && stop.latitude && stop.longitude;
      return isSelected && hasValidData;
    });
    
    return filtered;
  }, [selectedStops, stops]);

  // Get user's current location
  React.useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          console.warn('Could not get current location:', error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    }
  }, []);
  const handleOptimize = async () => {
    if (selectedStopData.length < 2) {
      setMessage('Please select at least 2 stops for optimization');
      return;
    }

    setLoading(true);
    setProgress(0);
    setCurrentStep('Initializing quantum optimization...');
    setMessage('');

    try {
      // Simulate progress updates
      const progressSteps = [
        { progress: 10, step: 'Calculating distance matrix using Haversine formula...' },
        { progress: 25, step: 'Preparing quantum circuit...' },
        { progress: 40, step: 'Executing QAOA algorithm...' },
        { progress: 65, step: 'Running quantum optimization...' },
        { progress: 80, step: 'Decoding quantum results...' },
        { progress: 95, step: 'Finalizing optimal route...' }
      ];

      for (const { progress: prog, step } of progressSteps) {
        await new Promise(resolve => setTimeout(resolve, 800));
        setProgress(prog);
        setCurrentStep(step);
      }

      // Determine starting point
      let startIndex = optimizationParams.start_index;
      if (useCurrentLocation && userLocation) {
        // Find the closest stop to current location as starting point
        let closestDistance = Infinity;
        selectedStopData.forEach((stop, index) => {
          const distance = calculateDistance(
            userLocation.latitude, userLocation.longitude,
            parseFloat(stop.latitude), parseFloat(stop.longitude)
          );
          if (distance < closestDistance) {
            closestDistance = distance;
            startIndex = index;
          }
        });
      }
      const result = await optimizeRoute({
        stop_ids: selectedStops,
        start_index: startIndex,
        quantum_backend: optimizationParams.quantum_backend,
        optimization_level: optimizationParams.optimization_level
      });

      if (!result.route || !Array.isArray(result.route)) {
        throw new Error('Invalid optimization result: missing route array');
      }

      setProgress(100);
      setCurrentStep('Hybrid quantum-classical optimization complete!');
      
      setTimeout(() => {
        onOptimizationComplete(result);
      }, 500);

    } catch (error) {
      console.error('Optimization failed:', error);
      setCurrentStep('Optimization failed');
      setMessage(`Error: ${error.message}`);
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
        if (!currentStep.includes('Error')) {
          setCurrentStep('');
        }
      }, 3000);
    }
  };

  const generatePreviewRoute = () => {
    if (selectedStopData.length < 2) return;
    
    setShowPreview(!showPreview);
  };

  const handleParamChange = (param, value) => {
    setOptimizationParams(prev => ({
      ...prev,
      [param]: value
    }));
  };

  const handleLocationToggle = () => {
    setUseCurrentLocation(!useCurrentLocation);
    if (!useCurrentLocation && !userLocation) {
      // Request location permission
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy
            });
          },
          (error) => {
            console.warn('Location access denied:', error);
            setMessage('Location access denied. Please enable location services.');
            setUseCurrentLocation(false);
          }
        );
      }
    }
  };
  // Debug info - let's see what we're getting
  console.log('QuantumDashboard render - selectedStops:', selectedStops);
  console.log('QuantumDashboard render - stops:', stops);
  console.log('QuantumDashboard render - selectedStopData:', selectedStopData);

  return (
    <div className="quantum-dashboard">
      <div className="card">
        <div className="card-header">
          <h2>🚀 Quantum Route Optimization</h2>
          <p>Advanced route optimization using quantum QAOA + classical algorithms</p>
        </div>

        <div className="optimization-setup">
          {/* Current Location Section */}
          {userLocation && (
            <div className="current-location-info">
              <h3>📍 Current Location</h3>
              <div className="location-card">
                <div className="location-details">
                  <p><strong>Coordinates:</strong> {userLocation.latitude.toFixed(6)}, {userLocation.longitude.toFixed(6)}</p>
                  <p><strong>Accuracy:</strong> ±{userLocation.accuracy ? Math.round(userLocation.accuracy) : 'Unknown'} meters</p>
                </div>
                <div className="location-toggle">
                  <label>
                    <input
                      type="checkbox"
                      checked={useCurrentLocation}
                      onChange={handleLocationToggle}
                    />
                    Use as starting point
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="selected-stops-info">
            <h3>Selected Stops ({selectedStopData.length})</h3>
            
            {selectedStopData.length > 0 ? (
              <div className="stops-grid">
                {selectedStopData.map((stop, index) => (
                  <div key={stop.id} className="stop-card">
                    <div className="stop-index">{index + 1}</div>
                    <div className="stop-info">
                      <strong>{stop.name}</strong>
                      <span className="coordinates">
                        {parseFloat(stop.latitude).toFixed(4)}, {parseFloat(stop.longitude).toFixed(4)}
                      </span>
                      {userLocation && (
                        <span className="distance-from-user">
                          📍 {calculateDistance(
                            userLocation.latitude, userLocation.longitude,
                            parseFloat(stop.latitude), parseFloat(stop.longitude)
                          ).toFixed(2)} km from you
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-stops-selected">
                <span className="icon">⚠️</span>
                <div>
                  <h4>No stops selected</h4>
                  <p>
                    Please go to the "Manage Stops" tab and select at least 2 stops for optimization.
                  </p>
                </div>
              </div>
            )}
          </div>

          {selectedStopData.length >= 2 && (
            <div className="route-preview-section">
              <div className="preview-header">
                <h3>🗺️ Route Preview</h3>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={generatePreviewRoute}
                  disabled={loading}
                >
                  {showPreview ? '🙈 Hide Preview' : '👁️ Show Preview'}
                </button>
              </div>
              
              {showPreview && (
                <div className="preview-map-container">
                  <InteractiveMap
                    stops={selectedStopData}
                    currentLocation={userLocation}
                    height="400px"
                    showAnimation={false}
                  />
                </div>
              )}
              
              <div className="preview-info">
                <p className="preview-note">
                  💡 Preview shows selected stops and current location. The optimized route will be calculated using hybrid quantum-classical algorithms.
                </p>
              </div>
            </div>
          )}

          {selectedStopData.length >= 2 && (
            <div className="optimization-params">
              <h3>Optimization Parameters</h3>
              
              {!useCurrentLocation && (
                <div className="param-group">
                  <label>Starting Stop</label>
                  <select
                    value={optimizationParams.start_index}
                    onChange={(e) => handleParamChange('start_index', parseInt(e.target.value))}
                    disabled={loading}
                  >
                    {selectedStopData.map((stop, index) => (
                      <option key={stop.id} value={index}>
                        {index + 1}. {stop.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="param-group">
                <label>Quantum Backend</label>
                <select
                  value={optimizationParams.quantum_backend}
                  onChange={(e) => handleParamChange('quantum_backend', e.target.value)}
                  disabled={loading}
                >
                  <option value="qasm_simulator">QASM Simulator</option>
                  <option value="statevector_simulator">Statevector Simulator</option>
                  <option value="ibm_quantum">IBM Quantum (Hardware)</option>
                </select>
              </div>

              <div className="param-group">
                <label>Optimization Level</label>
                <select
                  value={optimizationParams.optimization_level}
                  onChange={(e) => handleParamChange('optimization_level', parseInt(e.target.value))}
                  disabled={loading}
                >
                  <option value={1}>Level 1 - Fast (Classical only)</option>
                  <option value={2}>Level 2 - Balanced (Hybrid)</option>
                  <option value={3}>Level 3 - Thorough (Full Hybrid)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className="optimization-progress">
            <div className="progress-header">
              <h3>🔬 Hybrid Quantum-Classical Computing</h3>
              <span className="progress-percent">{progress}%</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="current-step">{currentStep}</p>
            <div className="quantum-animation">
              <div className="quantum-particle"></div>
              <div className="quantum-particle"></div>
              <div className="quantum-particle"></div>
            </div>
          </div>
        )}

        {message && (
          <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        <div className="optimization-action">
          <button
            className="btn btn-primary btn-large"
            onClick={handleOptimize}
            disabled={selectedStopData.length < 2 || loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Hybrid Computing...
              </>
            ) : (
              <>
                <span>⚛️</span>
                Start Hybrid Optimization
              </>
            )}
          </button>
        </div>
      </div>

      <div className="algorithm-info">
        <div className="info-card">
          <h3>🧮 Hybrid Quantum-Classical Optimization</h3>
          <p>
            Our hybrid approach combines quantum QAOA with classical algorithms including 
            simulated annealing, genetic algorithms, and ant colony optimization for 
            superior route optimization accuracy.
          </p>
          <ul>
            <li>✨ Quantum superposition for parallel exploration</li>
            <li>🔗 Entanglement for correlated decision making</li>
            <li>🧬 Genetic algorithms for population-based search</li>
            <li>🐜 Ant colony optimization for pheromone-based routing</li>
            <li>🔥 Simulated annealing for local optimization</li>
            <li>📏 Haversine formula for accurate distance calculations</li>
            <li>📍 Current location integration</li>
            <li>🚧 Real-time obstacle avoidance</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// Helper function to calculate distance between two points
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
export default QuantumDashboard;