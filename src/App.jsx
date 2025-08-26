import React, { useState, useEffect } from 'react';
import StopEntry from './components/StopEntry';
import CSVUpload from './components/CSVUpload';
import ImageOCRUpload from './components/ImageOCRUpload';
import RouteDisplay from './components/RouteDisplay';
import StopsList from './components/StopsList';
import QuantumDashboard from './components/QuantumDashboard';
import MapboxSetup from './components/MapboxSetup';
import { getAllStops, deleteStop } from './services/api';
import './App.css';

function App() {
  const [stops, setStops] = useState([]);
  const [selectedStops, setSelectedStops] = useState([]);
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('entry');

  useEffect(() => {
    loadStops();
  }, []);

  const loadStops = async () => {
    try {
      const stopsData = await getAllStops();
      setStops(stopsData);
    } catch (error) {
      console.error('Error loading stops:', error);
    }
  };

  const handleStopAdded = () => {
    loadStops();
  };

  const handleStopDeleted = async (stopId) => {
    try {
      await deleteStop(stopId);
      loadStops();
      // Remove from selected stops if it was selected
      setSelectedStops(prev => prev.filter(id => id !== stopId));
    } catch (error) {
      console.error('Error deleting stop:', error);
    }
  };

  const handleStopSelection = (stopId, selected) => {
    console.log('App - handleStopSelection:', stopId, selected);
    console.log('App - Current selectedStops before update:', selectedStops);
    console.log('App - Available stops:', stops.map(s => ({ id: s.id, name: s.name })));
    
    if (selected) {
      setSelectedStops(prev => {
        const newSelection = [...prev, stopId];
        console.log('App - Adding stop, new selection:', newSelection);
        return newSelection;
      });
    } else {
      setSelectedStops(prev => {
        const newSelection = prev.filter(id => id !== stopId);
        console.log('App - Removing stop, new selection:', newSelection);
        return newSelection;
      });
    }
  };

  const handleOptimizationComplete = (result) => {
    console.log('App - handleOptimizationComplete called with:', result);
    console.log('App - Current stops array:', stops);
    console.log('App - Current selectedStops:', selectedStops);
    setOptimizedRoute(result);
    // Automatically switch to results tab
    setActiveTab('results');
  };

  const tabs = [
    { id: 'entry', label: 'Add Stops', icon: '📍' },
    { id: 'upload', label: 'CSV Upload', icon: '📄' },
    { id: 'ocr', label: 'OCR Upload', icon: '📷' },
    { id: 'manage', label: 'Manage Stops', icon: '🗂️' },
    { id: 'optimize', label: 'Quantum Optimization', icon: '🚀' },
    { id: 'results', label: 'Results', icon: '📊' },
    { id: 'maps', label: 'Map Setup', icon: '🗺️' }
  ];

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>
            <span className="quantum-icon">⚛️</span>
            Quantum Path Planning
          </h1>
          <p className="subtitle">
            Optimize delivery routes using quantum computing and QAOA algorithms
          </p>
        </div>
        <div className="quantum-status">
          <div className="status-indicator active"></div>
          <span>Quantum Ready</span>
        </div>
      </header>

      <nav className="tab-navigation">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="app-main">
        <div className="content-wrapper">
          {activeTab === 'entry' && (
            <div className="tab-content">
              <StopEntry onStopAdded={handleStopAdded} />
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="tab-content">
              <CSVUpload onStopsUploaded={handleStopAdded} />
            </div>
          )}

          {activeTab === 'ocr' && (
            <div className="tab-content">
              <ImageOCRUpload onStopsUploaded={handleStopAdded} />
            </div>
          )}

          {activeTab === 'manage' && (
            <div className="tab-content">
              <StopsList 
                stops={stops}
                selectedStops={selectedStops}
                onStopSelection={handleStopSelection}
                onStopDeleted={handleStopDeleted}
              />
            </div>
          )}

          {activeTab === 'optimize' && (
            <div className="tab-content">
              <div style={{ padding: '1rem', background: '#f0f0f0', marginBottom: '1rem' }}>
                <strong>Debug Info:</strong>
                <div>Selected Stops: {JSON.stringify(selectedStops)}</div>
                <div>Total Stops: {stops.length}</div>
                <div>Active Tab: {activeTab}</div>
              </div>
              <QuantumDashboard
                selectedStops={selectedStops}
                stops={stops}
                onOptimizationComplete={handleOptimizationComplete}
                loading={loading}
                setLoading={setLoading}
              />
            </div>
          )}

          {activeTab === 'results' && (
            <div className="tab-content">
              <RouteDisplay 
                route={optimizedRoute}
                stops={stops}
              />
            </div>
          )}

          {activeTab === 'maps' && (
            <div className="tab-content">
              <MapboxSetup />
            </div>
          )}
        </div>
      </main>

      <footer className="app-footer">
        <p>Powered by IBM Qiskit • QAOA Algorithm • Haversine Formula</p>
        <div className="tech-badges">
          <span className="tech-badge">FastAPI</span>
          <span className="tech-badge">React</span>
          <span className="tech-badge">MySQL</span>
          <span className="tech-badge quantum">Quantum</span>
        </div>
      </footer>
    </div>
  );
}

export default App;