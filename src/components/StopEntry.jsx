import React, { useState } from 'react';
import { addStop } from '../services/api';
import geocodingService from '../services/geocodingService';

function StopEntry({ onStopAdded }) {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    latitude: '',
    longitude: ''
  });
  const [inputMode, setInputMode] = useState('location'); // 'location' or 'coordinates'
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [message, setMessage] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    
    // Clear suggestions when user types
    if (e.target.name === 'location') {
      setShowSuggestions(false);
      setLocationSuggestions([]);
    }
  };

  const handleLocationSearch = async () => {
    if (!formData.location.trim()) {
      setMessage('Please enter a location name');
      return;
    }

    setGeocoding(true);
    setMessage('');
    setLocationSuggestions([]);

    try {
      const results = await geocodingService.geocodeLocation(formData.location, {
        limit: 5,
        countryCode: 'in' // Bias towards India, remove or change as needed
      });

      if (results.length === 0) {
        setMessage('No locations found. Please try a different search term.');
        return;
      }

      setLocationSuggestions(results);
      setShowSuggestions(true);
      setMessage(`Found ${results.length} location${results.length > 1 ? 's' : ''}. Please select one.`);

    } catch (error) {
      console.error('Geocoding error:', error);
      setMessage(`Geocoding failed: ${error.message}. You can switch to manual coordinate entry.`);
    } finally {
      setGeocoding(false);
    }
  };

  const handleLocationSelect = (location) => {
    setFormData({
      ...formData,
      name: formData.name || location.name,
      location: location.name,
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString()
    });
    setLocationSuggestions([]);
    setShowSuggestions(false);
    setMessage(`Selected: ${location.name}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name) {
      setMessage('Stop name is required');
      return;
    }

    // Check if we have coordinates
    if (!formData.latitude || !formData.longitude) {
      if (inputMode === 'location' && formData.location) {
        setMessage('Please search for the location first to get coordinates');
      } else {
        setMessage('Coordinates are required. Please search for a location or enter coordinates manually.');
      }
      return;
    }

    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      setMessage('Please enter valid coordinates');
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setMessage('Coordinates are out of valid range');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await addStop({
        name: formData.name,
        latitude: lat,
        longitude: lng
      });

      setFormData({ name: '', location: '', latitude: '', longitude: '' });
      setLocationSuggestions([]);
      setShowSuggestions(false);
      setMessage('Stop added successfully!');
      onStopAdded();
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fillSampleData = () => {
    const samples = [
      { name: 'New York City', latitude: '40.7128', longitude: '-74.0060' },
      { name: 'Los Angeles', latitude: '34.0522', longitude: '-118.2437' },
      { name: 'Chicago', latitude: '41.8781', longitude: '-87.6298' },
      { name: 'Houston', latitude: '29.7604', longitude: '-95.3698' },
      { name: 'Phoenix', latitude: '33.4484', longitude: '-112.0740' }
    ];
    
    const sample = samples[Math.floor(Math.random() * samples.length)];
    setFormData({
      ...sample,
      location: sample.name
    });
  };

  const switchInputMode = (mode) => {
    setInputMode(mode);
    setMessage('');
    setLocationSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div className="stop-entry w-full box-border">
      <div className="card">
        <div className="card-header">
          <div>
            <h2>📍 Add New Stop</h2>
            <p>Add delivery stops by searching for locations or entering coordinates manually</p>
          </div>
          <div style={{
            background: 'rgba(102, 126, 234, 0.1)', 
            padding: '0.75rem 1rem', 
            borderRadius: '12px',
            border: '1px solid rgba(102, 126, 234, 0.2)',
            minWidth: 'fit-content'
          }}>
            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#667eea' }}>
              {inputMode === 'location' ? '🔍 Location Search' : '🎯 Manual Entry'}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="stop-form w-full box-border">
          {/* Input Mode Toggle */}
          <div className="form-group w-full box-border">
            <label>Input Method</label>
            <div style={{
              display: 'flex',
              gap: '1rem',
              marginTop: '0.5rem'
            }}>
              <button
                type="button"
                className={`btn ${inputMode === 'location' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => switchInputMode('location')}
                style={{ flex: 1 }}
              >
                🔍 Search Location
              </button>
              <button
                type="button"
                className={`btn ${inputMode === 'coordinates' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => switchInputMode('coordinates')}
                style={{ flex: 1 }}
              >
                🎯 Enter Coordinates
              </button>
            </div>
          </div>

          <div className="form-group w-full box-border">
            <label htmlFor="name">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🏷️ Stop Name
              </span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Main Distribution Center, Customer Location A"
              required
              style={{ 
                background: 'rgba(248, 250, 252, 0.8)',
                border: '2px solid #e5e7eb'
              }}
            />
          </div>

          {inputMode === 'location' && (
            <div className="form-group w-full box-border">
              <label htmlFor="location">
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🔍 Location Search
                  <span className="help-text">(City, Address, Landmark)</span>
                </span>
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g., Mumbai, Maharashtra or Times Square, New York"
                  style={{ 
                    flex: 1,
                    background: 'rgba(248, 250, 252, 0.8)',
                    border: '2px solid #e5e7eb'
                  }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleLocationSearch}
                  disabled={geocoding || !formData.location.trim()}
                  style={{ minWidth: '120px' }}
                >
                  {geocoding ? (
                    <>
                      <span className="spinner"></span>
                      Searching...
                    </>
                  ) : (
                    <>
                      🔍 Search
                    </>
                  )}
                </button>
              </div>
              
              {/* Location Suggestions */}
              {showSuggestions && locationSuggestions.length > 0 && (
                <div style={{
                  marginTop: '1rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  background: 'white',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  <div style={{
                    padding: '0.75rem 1rem',
                    background: 'rgba(102, 126, 234, 0.05)',
                    borderBottom: '1px solid #e2e8f0',
                    fontWeight: '600',
                    fontSize: '0.875rem'
                  }}>
                    📍 Select a location:
                  </div>
                  {locationSuggestions.map((location, index) => (
                    <div
                      key={index}
                      onClick={() => handleLocationSelect(location)}
                      style={{
                        padding: '1rem',
                        borderBottom: index < locationSuggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(102, 126, 234, 0.05)'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                        {location.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                        📍 {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        {location.type} • Confidence: {Math.round(location.confidence * 100)}% • {location.provider}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {inputMode === 'coordinates' && (
            <div className="form-row w-full box-border" style={{
            display: 'grid',
            gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : '1fr 1fr',
            gap: '1.5rem'
          }}>
            <div className="form-group w-full box-border">
              <label htmlFor="latitude">
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🌍 Latitude
                  <span className="help-text">(-90 to 90)</span>
                </span>
              </label>
              <input
                type="number"
                id="latitude"
                name="latitude"
                value={formData.latitude}
                onChange={handleChange}
                placeholder="40.7128"
                step="any"
                required={inputMode === 'coordinates'}
                style={{ 
                  background: 'rgba(248, 250, 252, 0.8)',
                  border: '2px solid #e5e7eb'
                }}
              />
            </div>

            <div className="form-group w-full box-border">
              <label htmlFor="longitude">
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🌐 Longitude
                  <span className="help-text">(-180 to 180)</span>
                </span>
              </label>
              <input
                type="number"
                id="longitude"
                name="longitude"
                value={formData.longitude}
                onChange={handleChange}
                placeholder="-74.0060"
                step="any"
                required={inputMode === 'coordinates'}
                style={{ 
                  background: 'rgba(248, 250, 252, 0.8)',
                  border: '2px solid #e5e7eb'
                }}
              />
            </div>
            </div>
          )}

          {/* Show coordinates when location is selected */}
          {inputMode === 'location' && formData.latitude && formData.longitude && (
            <div className="form-group w-full box-border">
              <label>📍 Selected Coordinates</label>
              <div style={{
                padding: '1rem',
                background: 'rgba(16, 185, 129, 0.05)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '0.875rem'
              }}>
                <div>Latitude: {formData.latitude}</div>
                <div>Longitude: {formData.longitude}</div>
              </div>
            </div>
          )}

          <div className="form-actions" style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'flex-end',
            marginTop: '2rem',
            flexWrap: 'wrap',
            width: '100%'
          }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={fillSampleData}
              style={{ 
                flex: window.innerWidth <= 768 ? '1 1 100%' : '1',
                order: window.innerWidth <= 768 ? 2 : 1
              }}
            >
              <span>🎲</span>
              Use Sample Data
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || geocoding}
              style={{ 
                flex: window.innerWidth <= 768 ? '1 1 100%' : '2',
                order: window.innerWidth <= 768 ? 1 : 2
              }}
            >
              {loading || geocoding ? (
                <>
                  <span className="spinner"></span>
                  {loading ? 'Adding...' : 'Searching...'}
                </>
              ) : (
                <>
                  <span>📍</span>
                  Add Stop
                </>
              )}
            </button>
          </div>
        </form>

        {message && (
          <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}
      </div>

      <div className="info-card w-full box-border">
        <h3>💡 Location Entry Guide</h3>
        <div style={{ 
          background: 'rgba(102, 126, 234, 0.05)', 
          padding: '1.5rem', 
          borderRadius: '12px', 
          marginTop: '1rem',
          border: '1px solid rgba(102, 126, 234, 0.1)'
        }}>
          <h4 style={{ margin: '0 0 1rem 0', color: '#667eea', fontSize: '1rem' }}>
            🔍 Location Search (Recommended)
          </h4>
          <div style={{ 
            display: 'grid', 
            gap: '0.75rem', 
            marginBottom: '1.5rem',
            fontSize: window.innerWidth <= 768 ? '0.8125rem' : '0.875rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: '#10b981' }}>✅</span>
              <span>Search by city name: "Mumbai", "New York", "London"</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: '#10b981' }}>✅</span>
              <span>Include state/country: "Mumbai, Maharashtra", "Austin, Texas"</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: '#10b981' }}>✅</span>
              <span>Search landmarks: "Times Square", "Eiffel Tower"</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: '#667eea' }}>🔍</span>
              <span>Multiple results will be shown for selection</span>
            </div>
          </div>
          
          <h4 style={{ margin: '0 0 1rem 0', color: '#667eea', fontSize: '1rem' }}>
            🎯 Coordinate Format
          </h4>
          <div style={{ 
            display: 'grid', 
            gap: '0.75rem', 
            fontSize: window.innerWidth <= 768 ? '0.8125rem' : '0.875rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#10b981' }}>✅</span>
              <span>Use decimal degrees format (e.g., 40.7128, -74.0060)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#10b981' }}>✅</span>
              <span>Latitude: North (+) / South (-)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#10b981' }}>✅</span>
              <span>Longitude: East (+) / West (-)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#667eea' }}>🔍</span>
              <span>Manual entry available if location search fails</span>
            </div>
          </div>
        </div>
        <ul style={{ 
          fontSize: window.innerWidth <= 768 ? '0.8125rem' : '0.875rem',
          lineHeight: '1.5'
        }}>
          <li>Location search uses multiple geocoding providers for accuracy</li>
          <li>Results show confidence scores to help you choose the best match</li>
          <li>Coordinates are automatically filled when you select a location</li>
          <li>Switch to manual entry if location search doesn't find your place</li>
          <li>Use the sample data button for quick testing</li>
        </ul>
      </div>
    </div>
  );
}

export default StopEntry;