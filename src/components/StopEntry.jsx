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
          <h2>Add New Stop</h2>
          <p>Enter delivery stop coordinates manually</p>
        </div>

        <form onSubmit={handleSubmit} className="stop-form">
          <div className="form-group">
            <label htmlFor="name">Stop Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Main Distribution Center"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="latitude">
                Latitude
                <span className="help-text">(-90 to 90)</span>
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
              />
            </div>

            <div className="form-group">
              <label htmlFor="longitude">
                Longitude
                <span className="help-text">(-180 to 180)</span>
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
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={fillSampleData}
            >
              Use Sample Data
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
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
        <h3>📍 Location Tips</h3>
        <ul>
          <li>Use decimal degrees format (e.g., 40.7128, -74.0060)</li>
          <li>Latitude: North (+) / South (-)</li>
          <li>Longitude: East (+) / West (-)</li>
          <li>Use tools like Google Maps to find precise coordinates</li>
        </ul>
      </div>
    </div>
  );
}

export default StopEntry;