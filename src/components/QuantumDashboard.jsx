import React, { useState } from 'react';
import { optimizeRoute } from '../services/api';

function QuantumDashboard({ selectedStops, stops, onOptimizationComplete, loading, setLoading }) {
  const [optimizationParams, setOptimizationParams] = useState({
    start_index: 0,
    quantum_backend: 'qasm_simulator',
    optimization_level: 1
  });
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');

  const selectedStopData = stops.filter(stop => selectedStops.includes(stop.id));

  const handleOptimize = async () => {
    if (selectedStops.length < 2) {
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

      setProgress(100);
      setCurrentStep('Optimization complete!');
      
      setTimeout(() => {
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

        <div className="optimization-setup">
          <div className="selected-stops-info">
            <h3>Selected Stops ({selectedStops.length})</h3>
            {selectedStopData.length > 0 ? (
              <div className="stops-grid">
                {selectedStopData.map((stop, index) => (
                  <div key={stop.id} className="stop-card">
                    <div className="stop-index">{index + 1}</div>
                    <div className="stop-info">
                      <strong>{stop.name}</strong>
                      <span className="coordinates">
                        {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-stops-selected">
                <span className="icon">⚠️</span>
                <p>No stops selected. Please select stops from the Manage Stops tab.</p>
              </div>
            )}
          </div>

          {selectedStops.length >= 2 && (
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
            disabled={selectedStops.length < 2 || loading}
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