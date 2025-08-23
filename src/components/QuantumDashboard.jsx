import React, { useState } from 'react';
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

  // Debug logging
  console.log('QuantumDashboard render - selectedStops:', selectedStops);
  console.log('QuantumDashboard render - stops:', stops);
  console.log('QuantumDashboard render - selectedStops type:', typeof selectedStops);
  console.log('QuantumDashboard render - stops type:', typeof stops);

  // Filter selected stops and ensure we have valid data
  const selectedStopData = React.useMemo(() => {
    console.log('Computing selectedStopData...');
    
    // Ensure we have valid arrays
    if (!Array.isArray(selectedStops)) {
      console.log('selectedStops is not an array:', selectedStops);
      return [];
    }
    
    if (!Array.isArray(stops)) {
      console.log('stops is not an array:', stops);
      return [];
    }
    
    if (selectedStops.length === 0) {
      console.log('No stops selected');
      return [];
    }
    
    if (stops.length === 0) {
      console.log('No stops available');
      return [];
    }
    
    console.log('Filtering stops...');
    console.log('Available stop IDs:', stops.map(s => s.id));
    console.log('Selected stop IDs:', selectedStops);
    
    const filtered = stops.filter(stop => {
      const isSelected = selectedStops.includes(stop.id);
      const hasValidData = stop && 
        typeof stop.id !== 'undefined' && 
        stop.name && 
        typeof stop.latitude !== 'undefined' && 
        typeof stop.longitude !== 'undefined' &&
        !isNaN(parseFloat(stop.latitude)) && 
        !isNaN(parseFloat(stop.longitude));
      
      console.log(`Stop ${stop.id} (${stop.name}): selected=${isSelected}, valid=${hasValidData}`);
      return isSelected && hasValidData;
    });
    
    console.log('Filtered result:', filtered);
    return filtered;
  }, [selectedStops, stops]);

  const handleOptimize = async () => {
    if (selectedStopData.length < 2) {
      alert('Please select at least 2 stops for optimization');
      return;
    }

    setLoading(true);
    setProgress(0);
    setCurrentStep('Initializing quantum optimization...');

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

      const result = await optimizeRoute({
        stop_ids: selectedStops,
        start_index: optimizationParams.start_index,
        quantum_backend: optimizationParams.quantum_backend,
        optimization_level: optimizationParams.optimization_level
      });

      console.log('Optimization result:', result);

      if (!result.route || !Array.isArray(result.route)) {
        throw new Error('Invalid optimization result: missing route array');
      }

      setProgress(100);
      setCurrentStep('Optimization complete!');
      
      setTimeout(() => {
        console.log('Calling onOptimizationComplete with result:', result);
        onOptimizationComplete(result);
      }, 500);

    } catch (error) {
      console.error('Optimization failed:', error);
      alert(`Optimization failed: ${error.message}`);
      setCurrentStep('Optimization failed');
    } finally {
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
        setCurrentStep('');
      }, 1000);
    }
  };

  const generatePreviewRoute = () => {
    if (selectedStopData.length < 2) return;
    
    const previewRouteData = {
      route: selectedStopData.map((_, index) => index),
      stops: selectedStopData,
      total_distance: 0,
      computation_time: 0,
      quantum_backend: 'Preview',
      optimization_level: 0
    };
    
    setPreviewRoute(previewRouteData);
  };

  const handleParamChange = (param, value) => {
    setOptimizationParams(prev => ({
      ...prev,
      [param]: value
    }));
  };

  return (
    <div className="quantum-dashboard">
      <div className="card">
        <div className="card-header">
          <h2>🚀 Quantum Route Optimization</h2>
          <p>Optimize delivery routes using QAOA quantum algorithm</p>
        </div>

        {/* Debug Information Panel */}
        <div style={{ 
          fontSize: '0.8rem', 
          color: '#666', 
          marginBottom: '1rem', 
          padding: '1rem', 
          background: '#f8f9fa', 
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <strong>🔍 Debug Information:</strong><br/>
          <div style={{ marginTop: '0.5rem', fontFamily: 'monospace' }}>
            Selected Stop IDs: {JSON.stringify(selectedStops)}<br/>
            Selected Stops Type: {typeof selectedStops} (Array: {Array.isArray(selectedStops) ? 'Yes' : 'No'})<br/>
            Total Stops Available: {stops ? stops.length : 'undefined'}<br/>
            Stops Type: {typeof stops} (Array: {Array.isArray(stops) ? 'Yes' : 'No'})<br/>
            Valid Selected Stops Found: {selectedStopData.length}<br/>
            {stops && stops.length > 0 && (
              <>Available Stop IDs: {stops.map(s => s.id).join(', ')}<br/></>
            )}
          </div>
        </div>

        <div className="optimization-setup">
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
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-stops-selected">
                <span className="icon">⚠️</span>
                {!Array.isArray(selectedStops) ? (
                  <div>
                    <h4>Invalid Selection Data</h4>
                    <p>Selected stops data is not in the expected format. Please refresh the page and try again.</p>
                  </div>
                ) : selectedStops.length === 0 ? (
                  <div>
                    <h4>No stops selected</h4>
                    <p>Please go to the "Manage Stops" tab and select at least 2 stops for optimization.</p>
                  </div>
                ) : !Array.isArray(stops) || stops.length === 0 ? (
                  <div>
                    <h4>No stops data available</h4>
                    <p>Please add some stops first using the "Add Stops" or "CSV Upload" tabs.</p>
                  </div>
                ) : (
                  <div>
                    <h4>Selected stops not found</h4>
                    <p>
                      {selectedStops.length} stop(s) selected but matching data not found. 
                      This might be due to:
                    </p>
                    <ul style={{ textAlign: 'left', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                      <li>Stops were deleted after selection</li>
                      <li>Data loading issue - try refreshing the page</li>
                      <li>Database connection problem</li>
                    </ul>
                  </div>
                )}
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
                  {previewRoute ? '🔄 Update Preview' : '👁️ Show Preview'}
                </button>
              </div>
              
              <div className="preview-map-container">
                <InteractiveMap
                  stops={selectedStopData}
                  route={previewRoute}
                  showAnimation={false}
                />
              </div>
              
              <div className="preview-info">
                <p className="preview-note">
                  💡 This preview shows your selected stops. The actual optimized route will be calculated using quantum algorithms.
                </p>
              </div>
            </div>
          )}

          {selectedStopData.length >= 2 && (
            <div className="optimization-params">
              <h3>Optimization Parameters</h3>
              
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
                  <option value={1}>Level 1 - Fast</option>
                  <option value={2}>Level 2 - Balanced</option>
                  <option value={3}>Level 3 - Thorough</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className="optimization-progress">
            <div className="progress-header">
              <h3>🔬 Quantum Computing in Progress</h3>
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

        <div className="optimization-action">
          <button
            className="btn btn-primary btn-large"
            onClick={handleOptimize}
            disabled={selectedStopData.length < 2 || loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Quantum Computing...
              </>
            ) : (
              <>
                <span>⚛️</span>
                Start Quantum Optimization
              </>
            )}
          </button>
        </div>
      </div>

      <div className="algorithm-info">
        <div className="info-card">
          <h3>🧮 QAOA Algorithm</h3>
          <p>
            The Quantum Approximate Optimization Algorithm (QAOA) uses quantum superposition 
            and entanglement to explore multiple route possibilities simultaneously, potentially 
            finding better solutions than classical methods.
          </p>
          <ul>
            <li>✨ Quantum superposition for parallel exploration</li>
            <li>🔗 Entanglement for correlated decision making</li>
            <li>📏 Haversine formula for accurate distance calculations</li>
            <li>🎯 One-way route optimization</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default QuantumDashboard;