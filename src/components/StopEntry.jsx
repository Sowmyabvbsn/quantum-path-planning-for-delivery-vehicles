import React, { useState } from 'react';
import { addStop } from '../services/api';

function StopEntry({ onStopAdded }) {
  const [formData, setFormData] = useState({
    name: '',
    latitude: '',
    longitude: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.latitude || !formData.longitude) {
      setMessage('All fields are required');
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

      setFormData({ name: '', latitude: '', longitude: '' });
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
    setFormData(sample);
  };

  return (
    <div className="stop-entry">
      <div className="card">
        <div className="card-header">
          <div>
            <h2>📍 Add New Stop</h2>
            <p>Enter delivery stop coordinates manually with precise location data</p>
          </div>
          <div style={{ 
            background: 'rgba(102, 126, 234, 0.1)', 
            padding: '0.75rem 1rem', 
            borderRadius: '12px',
            border: '1px solid rgba(102, 126, 234, 0.2)'
          }}>
            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#667eea' }}>
              🎯 Manual Entry
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="stop-form">
          <div className="form-group">
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

          <div className="form-row">
            <div className="form-group">
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
                required
                style={{ 
                  background: 'rgba(248, 250, 252, 0.8)',
                  border: '2px solid #e5e7eb'
                }}
              />
            </div>

            <div className="form-group">
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
                required
                style={{ 
                  background: 'rgba(248, 250, 252, 0.8)',
                  border: '2px solid #e5e7eb'
                }}
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={fillSampleData}
              style={{ flex: '1' }}
            >
              <span>🎲</span>
              Use Sample Data
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ flex: '2' }}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Adding...
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

      <div className="info-card">
        <h3>💡 Location Entry Tips</h3>
        <div style={{ 
          background: 'rgba(102, 126, 234, 0.05)', 
          padding: '1.5rem', 
          borderRadius: '12px', 
          marginTop: '1rem',
          border: '1px solid rgba(102, 126, 234, 0.1)'
        }}>
          <h4 style={{ margin: '0 0 1rem 0', color: '#667eea', fontSize: '1rem' }}>
            🎯 Coordinate Format
          </h4>
          <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.875rem' }}>
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
              <span>Use Google Maps to find precise coordinates</span>
            </div>
          </div>
        </div>
        <ul>
          <li>Right-click on Google Maps to get coordinates</li>
          <li>Ensure accuracy for optimal route calculation</li>
          <li>Double-check coordinates before adding</li>
          <li>Use the sample data button for quick testing</li>
        </ul>
      </div>
    </div>
  );
}

export default StopEntry;