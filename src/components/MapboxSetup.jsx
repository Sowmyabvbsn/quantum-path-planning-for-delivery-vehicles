import React, { useState, useEffect } from 'react';
import mapService from '../services/mapService';

function MapboxSetup() {
  const [apiKey, setApiKey] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: 'Please enter an API key' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Test the API key
      const isValid = await mapService.testConnection();
      
      if (isValid) {
        setTestResult({ 
          success: true, 
          message: 'MapTiler connection successful! Enhanced maps are now available.' 
        });
        
        // Store API key in localStorage for persistence
        localStorage.setItem('maptiler_api_key', apiKey);
      } else {
        setTestResult({ 
          success: false, 
          message: 'Invalid API key or connection failed' 
        });
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: `Connection test failed: ${error.message}` 
      });
    } finally {
      setTesting(false);
    }
  };

  const handleGetFreeKey = () => {
    window.open('https://www.maptiler.com/cloud/', '_blank');
  };

  useEffect(() => {
    // Load saved API key
    const savedKey = localStorage.getItem('maptiler_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  return (
    <div className="mapbox-setup">
      <div className="card">
        <div className="card-header">
          <h2>🗺️ Enhanced Map Service Setup</h2>
          <p>Configure MapTiler for professional map rendering (Free alternative to Mapbox)</p>
        </div>

        <div className="setup-content" style={{ padding: '2rem' }}>
          <div className="info-section" style={{
            background: 'rgba(102, 126, 234, 0.05)',
            padding: '1.5rem',
            borderRadius: '12px',
            marginBottom: '2rem',
            border: '1px solid rgba(102, 126, 234, 0.1)'
          }}>
            <h3>🆓 Free MapTiler Account</h3>
            <p>MapTiler offers 100,000 free map loads per month - perfect for development and small applications.</p>
            <ul>
              <li>✅ No credit card required for free tier</li>
              <li>✅ Professional map styles</li>
              <li>✅ High-resolution tiles</li>
              <li>✅ Geocoding and routing services</li>
              <li>✅ Better performance than basic OpenStreetMap</li>
            </ul>
            
            <button 
              className="btn btn-primary" 
              onClick={handleGetFreeKey}
              style={{ marginTop: '1rem' }}
            >
              🔗 Get Free MapTiler API Key
            </button>
          </div>

          <div className="api-key-section">
            <h3>API Key Configuration</h3>
            
            <div className="form-group">
              <label htmlFor="api-key">MapTiler API Key</label>
              <input
                type="text"
                id="api-key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your MapTiler API key here..."
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.875rem'
                }}
              />
              <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
                Your API key will be stored locally and used for enhanced map rendering
              </small>
            </div>

            <div className="form-actions" style={{ marginTop: '1.5rem' }}>
              <button
                className="btn btn-primary"
                onClick={handleTestConnection}
                disabled={testing || !apiKey.trim()}
              >
                {testing ? (
                  <>
                    <span className="spinner"></span>
                    Testing Connection...
                  </>
                ) : (
                  <>
                    🧪 Test Connection
                  </>
                )}
              </button>
            </div>

            {testResult && (
              <div className={`message ${testResult.success ? 'success' : 'error'}`} style={{ marginTop: '1rem' }}>
                {testResult.message}
              </div>
            )}
          </div>

          <div className="fallback-info" style={{
            background: 'rgba(248, 250, 252, 0.8)',
            padding: '1.5rem',
            borderRadius: '12px',
            marginTop: '2rem',
            border: '1px solid #e2e8f0'
          }}>
            <h3>🔄 Automatic Fallback</h3>
            <p>
              If MapTiler is not configured or unavailable, the application automatically falls back to 
              enhanced OpenStreetMap tiles with improved styling. Your application will work seamlessly 
              regardless of the map service configuration.
            </p>
            
            <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#64748b' }}>
              <strong>Current Status:</strong> {testResult?.success ? 
                '✅ MapTiler Active' : 
                '🔄 Using OpenStreetMap Fallback'
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MapboxSetup;