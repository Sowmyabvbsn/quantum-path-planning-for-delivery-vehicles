import React, { useState } from 'react';
import { uploadCSV } from '../services/api';

function CSVUpload({ onStopsUploaded }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setMessage('Please select a CSV file');
      return;
    }

    setFile(selectedFile);
    setMessage('');

    // Simple CSV preview without Papa Parse
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
          setMessage('CSV file is empty');
          return;
        }
        
        const headers = lines[0].split(',').map(h => h.trim());
        const dataRows = lines.slice(1, 6).map(line => {
          const values = line.split(',').map(v => v.trim());
          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          return row;
        });
        
        setPreview({
          data: dataRows,
          meta: { fields: headers }
        });
      } catch (error) {
        setMessage(`Error parsing CSV: ${error.message}`);
        setPreview(null);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Please select a file first');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const result = await uploadCSV(file);
      setMessage(result.message);
      setFile(null);
      setPreview(null);
      onStopsUploaded();
      
      // Reset file input
      const fileInput = document.getElementById('csv-file');
      if (fileInput) fileInput.value = '';
    } catch (error) {
      setMessage(`Upload failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadSample = () => {
    const sampleData = [
      { name: 'Distribution Center A', lat: 40.7128, lng: -74.0060 },
      { name: 'Delivery Point B', lat: 34.0522, lng: -118.2437 },
      { name: 'Warehouse C', lat: 41.8781, lng: -87.6298 },
      { name: 'Customer Location D', lat: 29.7604, lng: -95.3698 }
    ];

    const csv = [
      'name,lat,lng',
      'Distribution Center A,40.7128,-74.0060',
      'Delivery Point B,34.0522,-118.2437',
      'Warehouse C,41.8781,-87.6298',
      'Customer Location D,29.7604,-95.3698'
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'sample_stops.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="csv-upload">
      <div className="card">
        <div className="card-header">
          <div>
            <h2>📄 Upload Stops from CSV</h2>
            <p>Bulk import delivery stops from a CSV file for efficient data entry</p>
          </div>
          <div style={{ 
            background: 'rgba(16, 185, 129, 0.1)', 
            padding: '0.75rem 1rem', 
            borderRadius: '12px',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}>
            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#10b981' }}>
              📊 Bulk Import
            </div>
          </div>
        </div>

        <div className="upload-section">
          <div className="file-input-wrapper">
            <input
              type="file"
              id="csv-file"
              accept=".csv"
              onChange={handleFileSelect}
              className="file-input"
            />
            <label htmlFor="csv-file" className="file-input-label">
              <div className="upload-icon">📄</div>
              <div className="upload-text">
                {file ? (
                  <div>
                    <div style={{ fontWeight: '700', color: '#10b981', marginBottom: '0.5rem' }}>
                      ✅ File Selected
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      {file.name}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                      Choose CSV file or drag & drop
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                      Supports .csv files up to 10MB
                    </div>
                  </div>
                )}
              </div>
            </label>
          </div>

          <div className="upload-actions">
            <button
              className="btn btn-secondary"
              onClick={downloadSample}
              style={{ flex: '1' }}
            >
              <span>⬇️</span>
              Download Sample CSV
            </button>
            
            <button
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={!file || loading}
              style={{ flex: '1' }}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Uploading...
                </>
              ) : (
                <>
                  <span>⚡</span>
                  Upload Stops
                </>
              )}
            </button>
          </div>
        </div>

        {preview && (
          <div className="csv-preview">
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem', 
              marginBottom: '1.5rem',
              padding: '1rem',
              background: 'rgba(102, 126, 234, 0.05)',
              borderRadius: '12px',
              border: '1px solid rgba(102, 126, 234, 0.1)'
            }}>
              <span style={{ fontSize: '1.5rem' }}>👁️</span>
              <div>
                <h3 style={{ margin: '0', color: '#667eea' }}>CSV Preview</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>
                  Showing first 5 rows of your data
                </p>
              </div>
            </div>
            <div className="preview-table">
              <table>
                <thead>
                  <tr>
                    {preview.meta.fields.map((field, index) => (
                      <th key={index} style={{ 
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white'
                      }}>
                        {field}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.data.map((row, index) => (
                    <tr key={index} style={{ 
                      background: index % 2 === 0 ? 'rgba(248, 250, 252, 0.5)' : 'white' 
                    }}>
                      {preview.meta.fields.map((field, fieldIndex) => (
                        <td key={fieldIndex} style={{ 
                          fontFamily: field === 'lat' || field === 'lng' ? 'monospace' : 'inherit',
                          color: field === 'lat' || field === 'lng' ? '#6b7280' : 'inherit'
                        }}>
                          {row[field]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ 
              textAlign: 'center', 
              padding: '1rem',
              background: 'rgba(248, 250, 252, 0.8)',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              color: '#6b7280'
            }}>
              📊 Preview showing first 5 rows • Total rows in file: <strong>{preview.data.length}</strong>
            </div>
          </div>
        )}

        {message && (
          <div className={`message ${message.includes('failed') || message.includes('Error') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}
      </div>

      <div className="info-card">
        <h3>📋 CSV Format Requirements</h3>
        
        <div style={{ 
          background: 'rgba(102, 126, 234, 0.05)', 
          padding: '1.5rem', 
          borderRadius: '12px', 
          marginTop: '1rem',
          border: '1px solid rgba(102, 126, 234, 0.1)'
        }}>
          <h4 style={{ margin: '0 0 1rem 0', color: '#667eea', fontSize: '1rem' }}>
            📊 Required Columns
          </h4>
          <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <code style={{ 
                background: '#667eea', 
                color: 'white', 
                padding: '0.25rem 0.5rem', 
                borderRadius: '4px',
                fontSize: '0.8125rem',
                fontWeight: '600'
              }}>name</code>
              <span style={{ fontSize: '0.875rem' }}>Stop name or description</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <code style={{ 
                background: '#10b981', 
                color: 'white', 
                padding: '0.25rem 0.5rem', 
                borderRadius: '4px',
                fontSize: '0.8125rem',
                fontWeight: '600'
              }}>lat</code>
              <span style={{ fontSize: '0.875rem' }}>Latitude (-90 to 90)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <code style={{ 
                background: '#f59e0b', 
                color: 'white', 
                padding: '0.25rem 0.5rem', 
                borderRadius: '4px',
                fontSize: '0.8125rem',
                fontWeight: '600'
              }}>lng</code>
              <span style={{ fontSize: '0.875rem' }}>Longitude (-180 to 180)</span>
            </div>
          </div>
          
          <h4 style={{ margin: '0 0 1rem 0', color: '#667eea', fontSize: '1rem' }}>
            📝 Example Format
          </h4>
          <div style={{ 
            background: 'white', 
            padding: '1rem', 
            borderRadius: '8px', 
            border: '1px solid #e2e8f0',
            fontFamily: 'monospace',
            fontSize: '0.8125rem',
            overflow: 'auto'
          }}>
            <div style={{ color: '#667eea', fontWeight: '600', marginBottom: '0.5rem' }}>
              name,lat,lng
            </div>
            <div style={{ color: '#64748b' }}>
Distribution Center,40.7128,-74.0060
Customer A,40.7589,-73.9851
Customer B,40.6892,-74.0445
            </div>
          </div>
        </div>
        
        <ul style={{ marginTop: '1.5rem' }}>
          <li>Ensure your CSV file has headers in the first row</li>
          <li>Use comma-separated values without spaces after commas</li>
          <li>Coordinates should be in decimal degrees format</li>
          <li>File size should not exceed 10MB</li>
          <li>Download the sample file for reference</li>
        </ul>
      </div>
    </div>
  );
}

export default CSVUpload;