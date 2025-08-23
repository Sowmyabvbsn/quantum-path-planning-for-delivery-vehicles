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
          <h2>Upload Stops from CSV</h2>
          <p>Bulk import delivery stops from a CSV file</p>
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
              <span className="upload-icon">📄</span>
              <span className="upload-text">
                {file ? file.name : 'Choose CSV file or drag & drop'}
              </span>
            </label>
          </div>

          <div className="upload-actions">
            <button
              className="btn btn-secondary"
              onClick={downloadSample}
            >
              <span>⬇️</span>
              Download Sample CSV
            </button>
            
            <button
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={!file || loading}
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
            <h3>CSV Preview</h3>
            <div className="preview-table">
              <table>
                <thead>
                  <tr>
                    {preview.meta.fields.map((field, index) => (
                      <th key={index}>{field}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.data.map((row, index) => (
                    <tr key={index}>
                      {preview.meta.fields.map((field, fieldIndex) => (
                        <td key={fieldIndex}>{row[field]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="preview-note">
              Showing first 5 rows. Total rows: {preview.data.length}
            </p>
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
        <div className="format-example">
          <strong>Required columns:</strong>
          <ul>
            <li><code>name</code> - Stop name or description</li>
            <li><code>lat</code> - Latitude (-90 to 90)</li>
            <li><code>lng</code> - Longitude (-180 to 180)</li>
          </ul>
          
          <strong>Example:</strong>
          <pre>{`name,lat,lng
Distribution Center,40.7128,-74.0060
Customer A,40.7589,-73.9851
Customer B,40.6892,-74.0445`}</pre>
        </div>
      </div>
    </div>
  );
}

export default CSVUpload;