import React from 'react';

function MapLegend({ isVisible = true }) {
  if (!isVisible) return null;

  return (
    <div className="map-legend">
      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: '600' }}>
        Map Legend
      </h4>
      
      <div className="legend-item">
        <div className="legend-color" style={{ background: '#667eea' }}></div>
        <span>Route Stops</span>
      </div>
      
      <div className="legend-item">
        <div className="legend-color" style={{ background: '#10b981' }}></div>
        <span>OCR Extracted</span>
      </div>
      
      <div className="legend-item">
        <div className="legend-color" style={{ background: '#64748b' }}></div>
        <span>Other Stops</span>
      </div>
      
      <div className="legend-item">
        <div className="legend-color" style={{ background: '#ef4444' }}></div>
        <span>Obstacles</span>
      </div>
      
      <div className="legend-item">
        <div style={{ width: '20px', height: '2px', background: '#667eea' }}></div>
        <span>Optimized Route</span>
      </div>
      
      <div className="legend-item">
        <div style={{ width: '20px', height: '2px', background: '#e2e8f0', borderTop: '1px dashed #9ca3af' }}></div>
        <span>Direct Route</span>
      </div>
    </div>
  );
}

export default MapLegend;