import React, { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';
import { addStop } from '../services/api';

function ImageOCRUpload({ onStopsUploaded }) {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [extractedData, setExtractedData] = useState([]);
  const [message, setMessage] = useState('');
  const [currentStep, setCurrentStep] = useState('');
  const [processedStops, setProcessedStops] = useState([]);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage('Please select a valid image file (JPG, PNG, etc.)');
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setMessage('Image file is too large. Please select an image under 10MB.');
      return;
    }

    setImage(file);
    setMessage('');
    setExtractedData([]);
    setProcessedStops([]);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const preprocessImage = (imageElement) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match image
    canvas.width = imageElement.naturalWidth;
    canvas.height = imageElement.naturalHeight;
    
    // Draw original image
    ctx.drawImage(imageElement, 0, 0);
    
    // Get image data for processing
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Apply image preprocessing for better OCR
    for (let i = 0; i < data.length; i += 4) {
      // Convert to grayscale
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      
      // Apply threshold for better contrast
      const threshold = gray > 128 ? 255 : 0;
      
      data[i] = threshold;     // Red
      data[i + 1] = threshold; // Green
      data[i + 2] = threshold; // Blue
      // Alpha channel remains unchanged
    }
    
    // Put processed image data back
    ctx.putImageData(imageData, 0, 0);
    
    return canvas.toDataURL();
  };

  const performOCR = async () => {
    if (!image) {
      setMessage('Please select an image first');
      return;
    }

    setLoading(true);
    setOcrProgress(0);
    setCurrentStep('Initializing OCR engine...');
    setMessage('');

    try {
      // Create image element for preprocessing
      const img = new Image();
      img.onload = async () => {
        try {
          setCurrentStep('Preprocessing image for better OCR accuracy...');
          setOcrProgress(10);
          
          // Preprocess image
          const processedImageData = preprocessImage(img);
          
          setCurrentStep('Performing OCR text recognition...');
          setOcrProgress(25);

          // Perform OCR with optimized settings
          const { data: { text } } = await Tesseract.recognize(
            processedImageData,
            'eng',
            {
              logger: m => {
                if (m.status === 'recognizing text') {
                  const progress = Math.round(25 + (m.progress * 50));
                  setOcrProgress(progress);
                  setCurrentStep(`Recognizing text... ${Math.round(m.progress * 100)}%`);
                }
              },
              tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,- ()',
              tessedit_pageseg_mode: Tesseract.PSM.AUTO,
            }
          );

          setCurrentStep('Processing extracted text...');
          setOcrProgress(80);

          // Process the extracted text
          const processedData = processExtractedText(text);
          
          setCurrentStep('Validating location data...');
          setOcrProgress(90);

          // Validate and enrich the data
          const validatedData = await validateAndEnrichData(processedData);
          
          setExtractedData(validatedData);
          setOcrProgress(100);
          setCurrentStep('OCR processing complete!');
          
          if (validatedData.length === 0) {
            setMessage('No valid location data found in the image. Please ensure the image contains district names with coordinates.');
          } else {
            setMessage(`Successfully extracted ${validatedData.length} location entries from the image.`);
          }

        } catch (error) {
          console.error('OCR processing error:', error);
          setMessage(`OCR processing failed: ${error.message}`);
          setCurrentStep('OCR processing failed');
        } finally {
          setTimeout(() => {
            setLoading(false);
            setOcrProgress(0);
            setCurrentStep('');
          }, 2000);
        }
      };

      img.src = imagePreview;

    } catch (error) {
      console.error('OCR initialization error:', error);
      setMessage(`Failed to initialize OCR: ${error.message}`);
      setLoading(false);
      setCurrentStep('');
    }
  };

  const processExtractedText = (text) => {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const locationData = [];
    
    // Patterns to match different data formats
    const patterns = [
      // Pattern 1: District, State, Lat, Lng (comma separated)
      /^([^,]+),\s*([^,]+),\s*(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/,
      // Pattern 2: District State Lat Lng (space separated)
      /^([A-Za-z\s]+)\s+([A-Za-z\s]+)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/,
      // Pattern 3: More flexible pattern with coordinates
      /([A-Za-z\s]+).*?(-?\d{1,3}\.\d{4,})\s*,?\s*(-?\d{1,3}\.\d{4,})/
    ];

    for (const line of lines) {
      const cleanLine = line.trim();
      
      for (const pattern of patterns) {
        const match = cleanLine.match(pattern);
        if (match) {
          const [, district, state, lat, lng] = match;
          
          // Validate coordinates
          const latitude = parseFloat(lat);
          const longitude = parseFloat(lng);
          
          if (isValidCoordinate(latitude, longitude)) {
            locationData.push({
              district: district.trim(),
              stateName: state ? state.trim() : 'Unknown',
              latitude: latitude,
              longitude: longitude,
              source: 'OCR',
              confidence: calculateConfidence(cleanLine)
            });
            break; // Found a match, move to next line
          }
        }
      }
    }

    return locationData;
  };

  const isValidCoordinate = (lat, lng) => {
    return !isNaN(lat) && !isNaN(lng) && 
           lat >= -90 && lat <= 90 && 
           lng >= -180 && lng <= 180 &&
           Math.abs(lat) > 0.001 && Math.abs(lng) > 0.001; // Avoid zero coordinates
  };

  const calculateConfidence = (line) => {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence based on line characteristics
    if (line.includes(',')) confidence += 0.2; // Comma separated
    if (/\d+\.\d{4,}/.test(line)) confidence += 0.2; // High precision coordinates
    if (/[A-Z][a-z]+/.test(line)) confidence += 0.1; // Proper case names
    
    return Math.min(confidence, 1.0);
  };

  const validateAndEnrichData = async (data) => {
    // Remove duplicates and sort by confidence
    const uniqueData = data.filter((item, index, self) => 
      index === self.findIndex(t => 
        t.district === item.district && 
        Math.abs(t.latitude - item.latitude) < 0.001 &&
        Math.abs(t.longitude - item.longitude) < 0.001
      )
    ).sort((a, b) => b.confidence - a.confidence);

    // Validate against known Indian coordinates (if applicable)
    return uniqueData.filter(item => {
      // Basic validation for Indian subcontinent coordinates
      const isInIndia = item.latitude >= 6 && item.latitude <= 37 && 
                       item.longitude >= 68 && item.longitude <= 97;
      
      return isInIndia || (Math.abs(item.latitude) > 0 && Math.abs(item.longitude) > 0);
    });
  };

  const addSingleStop = async (stopData, index) => {
    try {
      const result = await addStop({
        name: `${stopData.district}, ${stopData.stateName}`,
        latitude: stopData.latitude,
        longitude: stopData.longitude
      });
      
      setProcessedStops(prev => [...prev, { ...stopData, id: result.id, status: 'success' }]);
      return { success: true, data: result };
    } catch (error) {
      setProcessedStops(prev => [...prev, { ...stopData, status: 'error', error: error.message }]);
      return { success: false, error: error.message };
    }
  };

  const addAllStops = async () => {
    if (extractedData.length === 0) {
      setMessage('No data to add. Please perform OCR first.');
      return;
    }

    setLoading(true);
    setCurrentStep('Adding stops to database...');
    setProcessedStops([]);
    
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < extractedData.length; i++) {
      const stopData = extractedData[i];
      setCurrentStep(`Adding stop ${i + 1} of ${extractedData.length}: ${stopData.district}`);
      setOcrProgress(Math.round((i / extractedData.length) * 100));
      
      const result = await addSingleStop(stopData, i);
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
      }
      
      // Small delay to prevent overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    setOcrProgress(100);
    setCurrentStep('All stops processed!');
    setMessage(`Processing complete: ${successCount} stops added successfully, ${errorCount} failed.`);
    
    if (successCount > 0) {
      onStopsUploaded();
    }

    setTimeout(() => {
      setLoading(false);
      setOcrProgress(0);
      setCurrentStep('');
    }, 2000);
  };

  const clearData = () => {
    setImage(null);
    setImagePreview(null);
    setExtractedData([]);
    setProcessedStops([]);
    setMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadSampleImage = () => {
    // Create a sample image with location data
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 800;
    canvas.height = 600;
    
    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Title
    ctx.fillStyle = 'black';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('Sample Location Data', 50, 50);
    
    // Headers
    ctx.font = 'bold 16px Arial';
    ctx.fillText('District, State, Latitude, Longitude', 50, 100);
    
    // Sample data
    const sampleData = [
      'Mumbai, Maharashtra, 19.0760, 72.8777',
      'Delhi, Delhi, 28.7041, 77.1025',
      'Bangalore, Karnataka, 12.9716, 77.5946',
      'Chennai, Tamil Nadu, 13.0827, 80.2707',
      'Kolkata, West Bengal, 22.5726, 88.3639'
    ];
    
    ctx.font = '14px Arial';
    sampleData.forEach((data, index) => {
      ctx.fillText(data, 50, 140 + (index * 30));
    });
    
    // Convert to blob and download
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sample_location_data.png';
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="image-ocr-upload w-full box-border">
      <div className="card">
        <div className="card-header">
          <div>
            <h2>📷 OCR Image Upload</h2>
            <p>Upload images containing location data and extract information using OCR</p>
          </div>
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)', 
            padding: '0.75rem 1rem', 
            borderRadius: '12px',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            minWidth: 'fit-content'
          }}>
            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#10b981' }}>
              🔍 OCR Processing
            </div>
          </div>
        </div>

        <div className="upload-section w-full box-border">
          <div className="file-input-wrapper w-full box-border">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="file-input"
            />
            <label htmlFor="image-file" className="file-input-label">
              <div className="upload-icon">📷</div>
              <div className="upload-text">
                {image ? (
                  <div>
                    <div style={{ fontWeight: '700', color: '#10b981', marginBottom: '0.5rem' }}>
                      ✅ Image Selected
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      {image.name}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                      Choose image file or drag & drop
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                      Supports JPG, PNG, etc. up to 10MB
                    </div>
                  </div>
                )}
              </div>
            </label>
          </div>

          {imagePreview && (
            <div className="image-preview w-full box-border" style={{ marginTop: '1.5rem' }}>
              <h3>📸 Image Preview</h3>
              <div style={{ 
                textAlign: 'center', 
                padding: '1rem',
                background: 'rgba(248, 250, 252, 0.8)',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '400px', 
                    borderRadius: '8px',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
                  }} 
                />
              </div>
            </div>
          )}

          <div className="upload-actions" style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginTop: '1.5rem'
          }}>
            <button
              className="btn btn-secondary"
              onClick={downloadSampleImage}
              style={{ flex: window.innerWidth <= 768 ? '1 1 100%' : '1' }}
            >
              <span>⬇️</span>
              Download Sample Image
            </button>
            
            <button
              className="btn btn-primary"
              onClick={performOCR}
              disabled={!image || loading}
              style={{ flex: window.innerWidth <= 768 ? '1 1 100%' : '1' }}
            >
              {loading && currentStep.includes('OCR') ? (
                <>
                  <span className="spinner"></span>
                  Processing OCR...
                </>
              ) : (
                <>
                  <span>🔍</span>
                  Extract Text with OCR
                </>
              )}
            </button>

            {image && (
              <button
                className="btn btn-danger"
                onClick={clearData}
                disabled={loading}
                style={{ flex: window.innerWidth <= 768 ? '1 1 100%' : '0 1 auto' }}
              >
                <span>🗑️</span>
                Clear
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div className="ocr-progress w-full box-border" style={{
            padding: '2rem',
            background: 'rgba(102, 126, 234, 0.05)',
            borderRadius: '16px',
            margin: '1.5rem 0'
          }}>
            <div className="progress-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h3>🔍 OCR Processing</h3>
              <span className="progress-percent">{ocrProgress}%</span>
            </div>
            <div className="progress-bar" style={{
              width: '100%',
              height: '8px',
              background: 'rgba(226, 232, 240, 0.5)',
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '1rem'
            }}>
              <div 
                className="progress-fill"
                style={{ 
                  width: `${ocrProgress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                  transition: 'width 0.3s ease'
                }}
              ></div>
            </div>
            <p className="current-step">{currentStep}</p>
          </div>
        )}

        {extractedData.length > 0 && (
          <div className="extracted-data w-full box-border">
            <div className="data-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              <h3>📊 Extracted Location Data ({extractedData.length} entries)</h3>
              <button
                className="btn btn-primary"
                onClick={addAllStops}
                disabled={loading}
                style={{ touchAction: 'manipulation' }}
              >
                {loading && currentStep.includes('Adding') ? (
                  <>
                    <span className="spinner"></span>
                    Adding Stops...
                  </>
                ) : (
                  <>
                    <span>📍</span>
                    Add All Stops
                  </>
                )}
              </button>
            </div>
            
            <div className="data-table w-full box-border">
              <table>
                <thead>
                  <tr>
                    <th>District</th>
                    <th>State</th>
                    <th>Latitude</th>
                    <th>Longitude</th>
                    <th>Confidence</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {extractedData.map((item, index) => {
                    const processedItem = processedStops.find(p => 
                      p.district === item.district && p.latitude === item.latitude
                    );
                    
                    return (
                      <tr key={index}>
                        <td>{item.district}</td>
                        <td>{item.stateName}</td>
                        <td style={{ fontFamily: 'monospace' }}>{item.latitude.toFixed(6)}</td>
                        <td style={{ fontFamily: 'monospace' }}>{item.longitude.toFixed(6)}</td>
                        <td>
                          <span style={{ 
                            color: item.confidence > 0.7 ? '#10b981' : item.confidence > 0.5 ? '#f59e0b' : '#ef4444',
                            fontWeight: 'bold'
                          }}>
                            {Math.round(item.confidence * 100)}%
                          </span>
                        </td>
                        <td>
                          {processedItem ? (
                            processedItem.status === 'success' ? (
                              <span style={{ color: '#10b981' }}>✅ Added</span>
                            ) : (
                              <span style={{ color: '#ef4444' }}>❌ Failed</span>
                            )
                          ) : (
                            <span style={{ color: '#64748b' }}>⏳ Pending</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {message && (
          <div className={`message ${message.includes('failed') || message.includes('Error') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}
      </div>

      {/* Hidden canvas for image preprocessing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="info-card w-full box-border">
        <h3>📋 OCR Image Upload Guide</h3>
        
        <div style={{ 
          background: 'rgba(102, 126, 234, 0.05)', 
          padding: '1.5rem', 
          borderRadius: '12px', 
          marginTop: '1rem',
          border: '1px solid rgba(102, 126, 234, 0.1)'
        }}>
          <h4 style={{ margin: '0 0 1rem 0', color: '#667eea', fontSize: '1rem' }}>
            📸 Supported Image Formats
          </h4>
          <div style={{ 
            display: 'grid', 
            gap: '0.75rem', 
            marginBottom: '1.5rem',
            fontSize: window.innerWidth <= 768 ? '0.8125rem' : '0.875rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: '#10b981' }}>✅</span>
              <span>Clear, high-resolution images (JPG, PNG, WEBP)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: '#10b981' }}>✅</span>
              <span>Tabular data with District, State, Latitude, Longitude</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: '#10b981' }}>✅</span>
              <span>Both handwritten and printed text</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: '#667eea' }}>🔍</span>
              <span>Good lighting and minimal background noise</span>
            </div>
          </div>
          
          <h4 style={{ margin: '0 0 1rem 0', color: '#667eea', fontSize: '1rem' }}>
            📝 Expected Data Format
          </h4>
          <div style={{ 
            background: 'white', 
            padding: '1rem', 
            borderRadius: '8px', 
            border: '1px solid #e2e8f0',
            fontFamily: 'monospace',
            fontSize: window.innerWidth <= 768 ? '0.75rem' : '0.8125rem',
            overflow: 'auto'
          }}>
            <div style={{ color: '#667eea', fontWeight: '600', marginBottom: '0.5rem' }}>
              District, State, Latitude, Longitude
            </div>
            <div style={{ color: '#64748b' }}>
Mumbai, Maharashtra, 19.0760, 72.8777<br/>
Delhi, Delhi, 28.7041, 77.1025<br/>
Bangalore, Karnataka, 12.9716, 77.5946
            </div>
          </div>
        </div>
        
        <ul style={{ 
          marginTop: '1.5rem',
          fontSize: window.innerWidth <= 768 ? '0.8125rem' : '0.875rem',
          lineHeight: '1.5'
        }}>
          <li>Ensure text is clearly visible and not blurred</li>
          <li>Use good lighting when capturing images</li>
          <li>Coordinates should be in decimal degrees format</li>
          <li>The system will validate coordinates for accuracy</li>
          <li>Download the sample image for reference format</li>
          <li>OCR works best with structured, tabular data</li>
        </ul>
      </div>
    </div>
  );
}

export default ImageOCRUpload;