import React, { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';
import { addStop } from '../services/api';
import geocodingService from '../services/geocodingService';

function ImageOCRUpload({ onStopsUploaded }) {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [extractedData, setExtractedData] = useState([]);
  const [message, setMessage] = useState('');
  const [currentStep, setCurrentStep] = useState('');
  const [processedStops, setProcessedStops] = useState([]);
  const [ocrMode, setOcrMode] = useState('auto'); // auto, printed, handwritten
  const [preprocessingOptions, setPreprocessingOptions] = useState({
    enhanceContrast: true,
    denoiseImage: true,
    sharpenText: true,
    normalizeSize: true
  });
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const originalCanvasRef = useRef(null);

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

  const advancedImagePreprocessing = (imageElement, mode = 'auto') => {
    const canvas = canvasRef.current;
    const originalCanvas = originalCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const originalCtx = originalCanvas.getContext('2d');
    
    // Set canvas size to match image
    const targetWidth = Math.min(imageElement.naturalWidth, 2000); // Limit max width for performance
    const targetHeight = (imageElement.naturalHeight * targetWidth) / imageElement.naturalWidth;
    
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    originalCanvas.width = targetWidth;
    originalCanvas.height = targetHeight;
    
    // Draw original image
    originalCtx.drawImage(imageElement, 0, 0, targetWidth, targetHeight);
    ctx.drawImage(imageElement, 0, 0, targetWidth, targetHeight);
    
    // Get image data for processing
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const originalData = new Uint8ClampedArray(data);
    
    // Step 1: Noise reduction using median filter
    if (preprocessingOptions.denoiseImage) {
      applyMedianFilter(data, canvas.width, canvas.height);
    }
    
    // Step 2: Enhance contrast for better text visibility
    if (preprocessingOptions.enhanceContrast) {
      enhanceContrast(data, mode);
    }
    
    // Step 3: Convert to grayscale with optimized weights for text
    convertToOptimizedGrayscale(data);
    
    // Step 4: Apply adaptive thresholding for handwritten text
    if (mode === 'handwritten' || mode === 'auto') {
      applyAdaptiveThreshold(data, canvas.width, canvas.height);
    } else {
      // Simple threshold for printed text
      applySimpleThreshold(data, 128);
    }
    
    // Step 5: Morphological operations to clean up text
    if (preprocessingOptions.sharpenText) {
      applyMorphologicalOperations(data, canvas.width, canvas.height, mode);
    }
    
    // Step 6: Skew correction for better OCR accuracy
    // Note: This is a simplified version - full skew correction would require more complex algorithms
    
    // Put processed image data back
    ctx.putImageData(imageData, 0, 0);
    
    return canvas.toDataURL('image/png', 1.0);
  };

  const applyMedianFilter = (data, width, height) => {
    const radius = 1;
    const tempData = new Uint8ClampedArray(data);
    
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        const idx = (y * width + x) * 4;
        
        // Collect neighboring pixels
        const neighbors = [];
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nIdx = ((y + dy) * width + (x + dx)) * 4;
            neighbors.push(tempData[nIdx]); // Red channel (grayscale)
          }
        }
        
        // Find median
        neighbors.sort((a, b) => a - b);
        const median = neighbors[Math.floor(neighbors.length / 2)];
        
        data[idx] = median;     // Red
        data[idx + 1] = median; // Green
        data[idx + 2] = median; // Blue
      }
    }
  };

  const enhanceContrast = (data, mode) => {
    // Calculate histogram
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      histogram[data[i]]++;
    }
    
    // Find min and max values (ignore extreme outliers)
    let min = 0, max = 255;
    const totalPixels = data.length / 4;
    const threshold = totalPixels * 0.01; // Ignore 1% outliers
    
    let count = 0;
    for (let i = 0; i < 256; i++) {
      count += histogram[i];
      if (count > threshold && min === 0) {
        min = i;
      }
      if (count > totalPixels - threshold && max === 255) {
        max = i;
        break;
      }
    }
    
    // Apply contrast stretching
    const range = max - min;
    if (range > 0) {
      for (let i = 0; i < data.length; i += 4) {
        const normalized = Math.max(0, Math.min(255, ((data[i] - min) * 255) / range));
        data[i] = normalized;
        data[i + 1] = normalized;
        data[i + 2] = normalized;
      }
    }
  };

  const convertToOptimizedGrayscale = (data) => {
    for (let i = 0; i < data.length; i += 4) {
      // Optimized weights for text recognition
      const gray = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
  };

  const applyAdaptiveThreshold = (data, width, height) => {
    const windowSize = 15;
    const C = 10; // Constant subtracted from mean
    const tempData = new Uint8ClampedArray(data);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // Calculate local mean
        let sum = 0;
        let count = 0;
        const halfWindow = Math.floor(windowSize / 2);
        
        for (let dy = -halfWindow; dy <= halfWindow; dy++) {
          for (let dx = -halfWindow; dx <= halfWindow; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              const nIdx = (ny * width + nx) * 4;
              sum += tempData[nIdx];
              count++;
            }
          }
        }
        
        const mean = sum / count;
        const threshold = mean - C;
        const value = tempData[idx] > threshold ? 255 : 0;
        
        data[idx] = value;
        data[idx + 1] = value;
        data[idx + 2] = value;
      }
    }
  };

  const applySimpleThreshold = (data, threshold) => {
    for (let i = 0; i < data.length; i += 4) {
      const value = data[i] > threshold ? 255 : 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }
  };

  const applyMorphologicalOperations = (data, width, height, mode) => {
    // Apply erosion followed by dilation (opening) to remove noise
    // Then apply dilation followed by erosion (closing) to fill gaps
    
    const structuringElement = mode === 'handwritten' 
      ? [[1, 1], [1, 1]] // Smaller kernel for handwritten text
      : [[1, 1, 1], [1, 1, 1], [1, 1, 1]]; // Larger kernel for printed text
    
    // Opening operation (erosion + dilation)
    const eroded = erode(data, width, height, structuringElement);
    const opened = dilate(eroded, width, height, structuringElement);
    
    // Closing operation (dilation + erosion)
    const dilated = dilate(opened, width, height, structuringElement);
    const closed = erode(dilated, width, height, structuringElement);
    
    // Copy result back to original data
    for (let i = 0; i < data.length; i++) {
      data[i] = closed[i];
    }
  };

  const erode = (data, width, height, kernel) => {
    const result = new Uint8ClampedArray(data);
    const kHeight = kernel.length;
    const kWidth = kernel[0].length;
    const kCenterY = Math.floor(kHeight / 2);
    const kCenterX = Math.floor(kWidth / 2);
    
    for (let y = kCenterY; y < height - kCenterY; y++) {
      for (let x = kCenterX; x < width - kCenterX; x++) {
        const idx = (y * width + x) * 4;
        let minVal = 255;
        
        for (let ky = 0; ky < kHeight; ky++) {
          for (let kx = 0; kx < kWidth; kx++) {
            if (kernel[ky][kx]) {
              const ny = y + ky - kCenterY;
              const nx = x + kx - kCenterX;
              const nIdx = (ny * width + nx) * 4;
              minVal = Math.min(minVal, data[nIdx]);
            }
          }
        }
        
        result[idx] = minVal;
        result[idx + 1] = minVal;
        result[idx + 2] = minVal;
      }
    }
    
    return result;
  };

  const dilate = (data, width, height, kernel) => {
    const result = new Uint8ClampedArray(data);
    const kHeight = kernel.length;
    const kWidth = kernel[0].length;
    const kCenterY = Math.floor(kHeight / 2);
    const kCenterX = Math.floor(kWidth / 2);
    
    for (let y = kCenterY; y < height - kCenterY; y++) {
      for (let x = kCenterX; x < width - kCenterX; x++) {
        const idx = (y * width + x) * 4;
        let maxVal = 0;
        
        for (let ky = 0; ky < kHeight; ky++) {
          for (let kx = 0; kx < kWidth; kx++) {
            if (kernel[ky][kx]) {
              const ny = y + ky - kCenterY;
              const nx = x + kx - kCenterX;
              const nIdx = (ny * width + nx) * 4;
              maxVal = Math.max(maxVal, data[nIdx]);
            }
          }
        }
        
        result[idx] = maxVal;
        result[idx + 1] = maxVal;
        result[idx + 2] = maxVal;
      }
    }
    
    return result;
  };

  const performOCR = async () => {
    if (!image) {
      setMessage('Please select an image first');
      return;
    }

    setLoading(true);
    setOcrProgress(0);
    setCurrentStep('Initializing advanced OCR engine...');
    setMessage('');

    try {
      // Create image element for preprocessing
      const img = new Image();
      img.onload = async () => {
        try {
          setCurrentStep('Applying advanced image preprocessing...');
          setOcrProgress(15);
          
          // Advanced preprocessing based on selected mode
          const processedImageData = advancedImagePreprocessing(img, ocrMode);
          
          setCurrentStep('Configuring OCR for handwritten text...');
          setOcrProgress(25);

          // Enhanced OCR configuration for handwritten text
          const ocrConfig = getOCRConfig(ocrMode);
          
          setCurrentStep('Performing OCR text recognition...');
          setOcrProgress(35);

          // Perform OCR with optimized settings
          const { data: { text, confidence } } = await Tesseract.recognize(
            processedImageData,
            ocrConfig.languages,
            {
              logger: m => {
                if (m.status === 'recognizing text') {
                  const progress = Math.round(35 + (m.progress * 40));
                  setOcrProgress(progress);
                  setCurrentStep(`Recognizing text... ${Math.round(m.progress * 100)}%`);
                }
              },
              ...ocrConfig.options
            }
          );

          setCurrentStep('Processing and validating extracted text...');
          setOcrProgress(80);

          console.log('OCR Confidence:', confidence);
          console.log('Extracted text:', text);

          // Process the extracted text with improved algorithms
          const processedData = await processExtractedTextAdvanced(text, confidence);
          
          setCurrentStep('Geocoding and validating locations...');
          setOcrProgress(90);

          // Filter and validate entries
          const validatedData = processedData.filter(item => 
            item.name && item.name.length > 2 && 
            (item.latitude || item.confidence > 0.3)
          );
          
          setExtractedData(validatedData);
          setOcrProgress(100);
          setCurrentStep('Advanced OCR processing complete!');
          
          if (validatedData.length === 0) {
            setMessage(`No valid location data found. OCR confidence: ${Math.round(confidence)}%. Try adjusting the OCR mode or image quality.`);
          } else {
            const withCoords = validatedData.filter(item => item.latitude && item.longitude).length;
            const withoutCoords = validatedData.length - withCoords;
            setMessage(`Successfully extracted ${validatedData.length} entries (${withCoords} with coordinates, ${withoutCoords} require geocoding). OCR confidence: ${Math.round(confidence)}%`);
          }

        } catch (error) {
          console.error('OCR processing error:', error);
          setMessage(`OCR processing failed: ${error.message}. Try adjusting preprocessing options or OCR mode.`);
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

  const getOCRConfig = (mode) => {
    const baseConfig = {
      languages: 'eng+hin+ara+chi_sim', // Extended language support
      options: {
        preserve_interword_spaces: '1',
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,- /',
      }
    };

    switch (mode) {
      case 'handwritten':
        return {
          ...baseConfig,
          options: {
            ...baseConfig.options,
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
            tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
            // Remove character whitelist for handwritten text
            tessedit_char_whitelist: undefined,
            // Enable handwritten text optimizations
            textord_heavy_nr: '1',
            textord_noise_normratio: '2',
            textord_noise_sizelimit: '0.5',
            // Adjust for handwritten characteristics
            textord_min_linesize: '1.25',
            textord_excess_blobsize: '1.3',
          }
        };
      
      case 'printed':
        return {
          ...baseConfig,
          options: {
            ...baseConfig.options,
            tessedit_pageseg_mode: Tesseract.PSM.AUTO,
            tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          }
        };
      
      default: // auto
        return {
          ...baseConfig,
          options: {
            ...baseConfig.options,
            tessedit_pageseg_mode: Tesseract.PSM.AUTO_OSD,
            tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
            // Remove character whitelist for auto mode
            tessedit_char_whitelist: undefined,
          }
        };
    }
  };

  const processExtractedTextAdvanced = async (text, confidence) => {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const locationData = [];
    
    setCurrentStep('Processing extracted locations with advanced algorithms...');

    // Enhanced text cleaning and pattern recognition
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cleanLine = advancedTextCleaning(line);
      
      if (cleanLine.length < 2) continue;
      
      // Update progress for geocoding
      const geocodingProgress = Math.round((i / lines.length) * 15) + 80;
      setOcrProgress(geocodingProgress);
      setCurrentStep(`Processing location ${i + 1} of ${lines.length}: ${cleanLine.substring(0, 30)}...`);
      
      try {
        // Enhanced coordinate extraction
        const coordinateMatch = extractCoordinatesAdvanced(cleanLine);
        
        if (coordinateMatch) {
          const { latitude, longitude, locationName } = coordinateMatch;
          
          if (isValidCoordinate(latitude, longitude)) {
            locationData.push({
              name: locationName || cleanLine,
              latitude: latitude,
              longitude: longitude,
              source: 'OCR_with_coordinates',
              confidence: Math.min(0.95, confidence / 100 + 0.2),
              originalText: line,
              ocrMode: ocrMode
            });
          }
        } else {
          // Enhanced location name extraction and geocoding
          const locationNames = extractLocationNamesAdvanced(cleanLine);
          
          for (const locationName of locationNames) {
            if (locationName.length > 2) {
              try {
                // Enhanced geocoding with multiple strategies
                const geocodeResults = await geocodingService.geocodeLocation(locationName, {
                  limit: 1,
                  countryCode: 'in' // Bias towards India for better results
                });
                
                if (geocodeResults && geocodeResults.length > 0) {
                  const result = geocodeResults[0];
                  locationData.push({
                    name: result.name || locationName,
                    latitude: result.latitude,
                    longitude: result.longitude,
                    source: 'OCR_geocoded',
                    confidence: Math.min(0.9, (result.confidence || 0.7) * (confidence / 100)),
                    originalText: line,
                    geocodingProvider: result.provider,
                    ocrMode: ocrMode
                  });
                } else {
                  // Add without coordinates for manual review
                  locationData.push({
                    name: locationName,
                    latitude: null,
                    longitude: null,
                    source: 'OCR_needs_geocoding',
                    confidence: Math.max(0.3, confidence / 100),
                    originalText: line,
                    ocrMode: ocrMode
                  });
                }
              } catch (geocodeError) {
                console.warn(`Geocoding failed for "${locationName}":`, geocodeError.message);
                locationData.push({
                  name: locationName,
                  latitude: null,
                  longitude: null,
                  source: 'OCR_failed_geocoding',
                  confidence: Math.max(0.2, confidence / 100),
                  originalText: line,
                  error: geocodeError.message,
                  ocrMode: ocrMode
                });
              }
            }
          }
        }
        
        // Respect rate limits
        await new Promise(resolve => setTimeout(resolve, 150));
        
      } catch (error) {
        console.warn(`Error processing line "${cleanLine}":`, error);
      }
    }

    return locationData;
  };

  const advancedTextCleaning = (text) => {
    // Enhanced cleaning for handwritten text OCR artifacts
    let cleaned = text
      .replace(/[^\w\s,.-]/g, ' ') // Remove special characters except common ones
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\b\d+\b/g, '') // Remove standalone numbers
      .replace(/[,.-]+$/, '') // Remove trailing punctuation
      .trim();
    
    // Enhanced OCR error corrections for handwritten text
    const corrections = {
      // Common handwritten OCR errors
      'rn': 'm', 'vv': 'w', 'ii': 'n', 'cl': 'd', 'ri': 'n',
      '0': 'O', '1': 'I', '5': 'S', '8': 'B', '6': 'G',
      // Handwritten specific corrections
      'a': 'a', 'e': 'e', 'i': 'i', 'o': 'o', 'u': 'u',
      // Common word corrections
      'Mumbei': 'Mumbai', 'Deihi': 'Delhi', 'Bengaiuru': 'Bangalore',
      'Chennei': 'Chennai', 'Koikata': 'Kolkata', 'Pune': 'Pune'
    };
    
    // Apply corrections
    Object.entries(corrections).forEach(([wrong, right]) => {
      const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
      cleaned = cleaned.replace(regex, right);
    });
    
    // Remove very short words that are likely OCR artifacts
    cleaned = cleaned.split(' ').filter(word => word.length > 1).join(' ');
    
    return cleaned;
  };

  const extractCoordinatesAdvanced = (text) => {
    // Enhanced coordinate extraction patterns
    const patterns = [
      // Decimal degrees with various separators
      /([^,\d-]*?)(-?\d{1,3}\.?\d{0,8})[,\s]+(-?\d{1,3}\.?\d{0,8})/,
      // Degrees with direction indicators
      /([^,\d-]*?)(\d{1,3}\.?\d{0,8})[°\s]*[NS][,\s]+(\d{1,3}\.?\d{0,8})[°\s]*[EW]/i,
      // Coordinates at end of line
      /(.+?)\s+(-?\d{1,3}\.\d{4,})\s*,?\s*(-?\d{1,3}\.\d{4,})$/,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const [, locationName, lat, lng] = match;
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
        
        if (isValidCoordinate(latitude, longitude)) {
          return {
            latitude,
            longitude,
            locationName: locationName ? locationName.trim() : null
          };
        }
      }
    }
    
    return null;
  };

  const extractLocationNamesAdvanced = (text) => {
    // Enhanced location name extraction
    const locationNames = [];
    
    // Split by common separators
    const parts = text.split(/[,;|\n]/);
    
    for (const part of parts) {
      const cleaned = part.trim();
      if (cleaned.length > 2) {
        // Check if it looks like a location name
        if (isLikelyLocationName(cleaned)) {
          locationNames.push(cleaned);
        }
      }
    }
    
    // If no parts found, try the whole text
    if (locationNames.length === 0 && isLikelyLocationName(text)) {
      locationNames.push(text);
    }
    
    return locationNames;
  };

  const isLikelyLocationName = (text) => {
    // Enhanced location name detection
    const locationIndicators = [
      // Indian states and cities
      /mumbai|delhi|bangalore|chennai|kolkata|pune|hyderabad|ahmedabad/i,
      /maharashtra|karnataka|tamil nadu|west bengal|gujarat|telangana/i,
      // Common location words
      /city|town|village|district|state|nagar|pur|bad|ganj/i,
      // General patterns
      /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/,
    ];
    
    // Check against patterns
    for (const pattern of locationIndicators) {
      if (pattern.test(text)) {
        return true;
      }
    }
    
    // Check if it has reasonable length and structure
    return text.length >= 3 && text.length <= 50 && /^[A-Za-z\s-]+$/.test(text);
  };

  const isValidCoordinate = (lat, lng) => {
    return !isNaN(lat) && !isNaN(lng) && 
           lat >= -90 && lat <= 90 && 
           lng >= -180 && lng <= 180 &&
           Math.abs(lat) > 0.001 && Math.abs(lng) > 0.001;
  };

  const addSingleStop = async (stopData, index) => {
    if (!stopData.latitude || !stopData.longitude) {
      setProcessedStops(prev => [...prev, { 
        ...stopData, 
        status: 'skipped', 
        error: 'No coordinates available' 
      }]);
      return { success: false, error: 'No coordinates available' };
    }

    try {
      const result = await addStop({
        name: stopData.name,
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

    const validEntries = extractedData.filter(item => item.latitude && item.longitude);
    const invalidEntries = extractedData.filter(item => !item.latitude || !item.longitude);

    if (invalidEntries.length > 0) {
      setMessage(`Skipping ${invalidEntries.length} entries without coordinates. Processing ${validEntries.length} valid entries.`);
    }

    for (let i = 0; i < validEntries.length; i++) {
      const stopData = validEntries[i];
      setCurrentStep(`Adding stop ${i + 1} of ${validEntries.length}: ${stopData.name}`);
      setOcrProgress(Math.round((i / validEntries.length) * 100));
      
      const result = await addSingleStop(stopData, i);
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    invalidEntries.forEach(item => {
      setProcessedStops(prev => [...prev, { ...item, status: 'skipped', error: 'No coordinates' }]);
    });

    setOcrProgress(100);
    setCurrentStep('All stops processed!');
    const skippedCount = invalidEntries.length;
    setMessage(`Processing complete: ${successCount} stops added successfully, ${errorCount} failed, ${skippedCount} skipped (no coordinates).`);
    
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
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 800;
    canvas.height = 600;
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'black';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('Sample Handwritten Location Data', 50, 50);
    
    ctx.font = 'bold 16px Arial';
    ctx.fillText('Write location names clearly:', 50, 100);
    
    const sampleData = [
      'Mumbai, Maharashtra',
      'New Delhi',
      'Bangalore, Karnataka', 
      'Chennai, Tamil Nadu',
      'Kolkata, West Bengal',
      'Pune, Maharashtra',
      'Hyderabad, Telangana',
      'Ahmedabad, Gujarat'
    ];
    
    ctx.font = '18px Arial';
    sampleData.forEach((data, index) => {
      ctx.fillText(data, 50, 140 + (index * 40));
    });
    
    ctx.font = '12px Arial';
    ctx.fillStyle = '#666';
    ctx.fillText('Tip: Write clearly with good contrast for best OCR results', 50, 500);
    
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'handwritten_sample_locations.png';
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="image-ocr-upload w-full box-border">
      <div className="card">
        <div className="card-header">
          <div>
            <h2>📷 Advanced OCR Image Upload</h2>
            <p>Upload images with handwritten or printed location data using advanced OCR processing</p>
          </div>
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)', 
            padding: '0.75rem 1rem', 
            borderRadius: '12px',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            minWidth: 'fit-content'
          }}>
            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#10b981' }}>
              🔍 Advanced OCR
            </div>
          </div>
        </div>

        <div className="upload-section w-full box-border">
          {/* OCR Mode Selection */}
          <div className="ocr-mode-selection w-full box-border" style={{ marginBottom: '1.5rem' }}>
            <h3>🎯 OCR Mode Selection</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : 'repeat(3, 1fr)',
              gap: '1rem',
              marginTop: '1rem'
            }}>
              <button
                className={`btn ${ocrMode === 'auto' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setOcrMode('auto')}
                disabled={loading}
              >
                🤖 Auto Detect
              </button>
              <button
                className={`btn ${ocrMode === 'handwritten' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setOcrMode('handwritten')}
                disabled={loading}
              >
                ✍️ Handwritten
              </button>
              <button
                className={`btn ${ocrMode === 'printed' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setOcrMode('printed')}
                disabled={loading}
              >
                🖨️ Printed Text
              </button>
            </div>
            <p style={{ 
              fontSize: '0.875rem', 
              color: '#64748b', 
              marginTop: '0.5rem',
              textAlign: 'center'
            }}>
              {ocrMode === 'handwritten' && '✍️ Optimized for handwritten text with advanced preprocessing'}
              {ocrMode === 'printed' && '🖨️ Optimized for printed text with high accuracy'}
              {ocrMode === 'auto' && '🤖 Automatically detects and processes both handwritten and printed text'}
            </p>
          </div>

          {/* Preprocessing Options */}
          <div className="preprocessing-options w-full box-border" style={{ marginBottom: '1.5rem' }}>
            <h3>⚙️ Image Enhancement Options</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : 'repeat(2, 1fr)',
              gap: '1rem',
              marginTop: '1rem',
              padding: '1rem',
              background: 'rgba(248, 250, 252, 0.8)',
              borderRadius: '12px',
              border: '1px solid #e2e8f0'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={preprocessingOptions.enhanceContrast}
                  onChange={(e) => setPreprocessingOptions(prev => ({
                    ...prev,
                    enhanceContrast: e.target.checked
                  }))}
                  disabled={loading}
                />
                <span>📈 Enhance Contrast</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={preprocessingOptions.denoiseImage}
                  onChange={(e) => setPreprocessingOptions(prev => ({
                    ...prev,
                    denoiseImage: e.target.checked
                  }))}
                  disabled={loading}
                />
                <span>🧹 Remove Noise</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={preprocessingOptions.sharpenText}
                  onChange={(e) => setPreprocessingOptions(prev => ({
                    ...prev,
                    sharpenText: e.target.checked
                  }))}
                  disabled={loading}
                />
                <span>🔍 Sharpen Text</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={preprocessingOptions.normalizeSize}
                  onChange={(e) => setPreprocessingOptions(prev => ({
                    ...prev,
                    normalizeSize: e.target.checked
                  }))}
                  disabled={loading}
                />
                <span>📏 Normalize Size</span>
              </label>
            </div>
          </div>

          <div className="file-input-wrapper w-full box-border">
            <input
              ref={fileInputRef}
              id="image-file-input"
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="file-input"
            />
            <label htmlFor="image-file-input" className="file-input-label">
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
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                      Mode: {ocrMode === 'auto' ? '🤖 Auto' : ocrMode === 'handwritten' ? '✍️ Handwritten' : '🖨️ Printed'}
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
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                      Optimized for handwritten text recognition
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
                display: 'grid',
                gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : '1fr 1fr',
                gap: '1rem',
                padding: '1rem',
                background: 'rgba(248, 250, 252, 0.8)',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <div>
                  <h4>Original Image</h4>
                  <img 
                    src={imagePreview} 
                    alt="Original" 
                    style={{ 
                      width: '100%', 
                      maxHeight: '300px', 
                      objectFit: 'contain',
                      borderRadius: '8px',
                      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
                    }} 
                  />
                </div>
                <div>
                  <h4>Processing Preview</h4>
                  <canvas 
                    ref={canvasRef}
                    style={{ 
                      width: '100%', 
                      maxHeight: '300px', 
                      objectFit: 'contain',
                      borderRadius: '8px',
                      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
                      background: '#f8f9fa'
                    }} 
                  />
                  <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                    Preview will show after OCR processing
                  </p>
                </div>
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
              Download Sample
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
                  Processing...
                </>
              ) : (
                <>
                  <span>🔍</span>
                  {ocrMode === 'handwritten' ? 'Extract Handwritten Text' : 
                   ocrMode === 'printed' ? 'Extract Printed Text' : 
                   'Auto Extract Text'}
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
              <h3>🔍 Advanced OCR Processing</h3>
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
                  background: ocrMode === 'handwritten' 
                    ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                  transition: 'width 0.3s ease'
                }}
              ></div>
            </div>
            <p className="current-step">{currentStep}</p>
            <div style={{ 
              fontSize: '0.75rem', 
              color: '#64748b', 
              marginTop: '0.5rem',
              textAlign: 'center'
            }}>
              Mode: {ocrMode === 'handwritten' ? '✍️ Handwritten Text Optimization' : 
                     ocrMode === 'printed' ? '🖨️ Printed Text Optimization' : 
                     '🤖 Auto Detection Mode'}
            </div>
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
                    <th>Location Name</th>
                    <th>Coordinates</th>
                    <th>Source</th>
                    <th>Confidence</th>
                    <th>OCR Mode</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {extractedData.map((item, index) => {
                    const processedItem = processedStops.find(p => 
                      p.name === item.name && Math.abs((p.latitude || 0) - (item.latitude || 0)) < 0.001
                    );
                    
                    return (
                      <tr key={index}>
                        <td>{item.name}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {item.latitude && item.longitude ? (
                            <div>
                              <div>{item.latitude.toFixed(6)}</div>
                              <div>{item.longitude.toFixed(6)}</div>
                            </div>
                          ) : (
                            <span style={{ color: '#f59e0b' }}>Needs geocoding</span>
                          )}
                        </td>
                        <td>
                          <span style={{ 
                            fontSize: '0.75rem',
                            color: item.source === 'OCR_geocoded' ? '#10b981' : 
                                   item.source === 'OCR_with_coordinates' ? '#667eea' : '#f59e0b'
                          }}>
                            {item.source === 'OCR_geocoded' ? '🌍 Geocoded' :
                             item.source === 'OCR_with_coordinates' ? '📍 Direct' :
                             item.source === 'OCR_needs_geocoding' ? '🔍 Pending' :
                             item.source === 'OCR_failed_geocoding' ? '❌ Failed' : 'OCR'}
                          </span>
                        </td>
                        <td>
                          <span style={{ 
                            color: item.confidence > 0.7 ? '#10b981' : item.confidence > 0.4 ? '#f59e0b' : '#ef4444',
                            fontWeight: 'bold',
                            fontSize: '0.875rem'
                          }}>
                            {Math.round(item.confidence * 100)}%
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.75rem' }}>
                            {item.ocrMode === 'handwritten' ? '✍️' : 
                             item.ocrMode === 'printed' ? '🖨️' : '🤖'}
                          </span>
                        </td>
                        <td>
                          {processedItem ? (
                            processedItem.status === 'success' ? (
                              <span style={{ color: '#10b981' }}>✅ Added</span>
                            ) : processedItem.status === 'skipped' ? (
                              <span style={{ color: '#f59e0b' }}>⏭️ Skipped</span>
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

      {/* Hidden canvases for image processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <canvas ref={originalCanvasRef} style={{ display: 'none' }} />

      <div className="info-card w-full box-border">
        <h3>📋 Advanced OCR Guide</h3>
        
        <div style={{ 
          background: 'rgba(102, 126, 234, 0.05)', 
          padding: '1.5rem', 
          borderRadius: '12px', 
          marginTop: '1rem',
          border: '1px solid rgba(102, 126, 234, 0.1)'
        }}>
          <h4 style={{ margin: '0 0 1rem 0', color: '#667eea', fontSize: '1rem' }}>
            ✍️ Handwritten Text Optimization
          </h4>
          <div style={{ 
            display: 'grid', 
            gap: '0.75rem', 
            marginBottom: '1.5rem',
            fontSize: window.innerWidth <= 768 ? '0.8125rem' : '0.875rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: '#10b981' }}>✅</span>
              <span>Advanced preprocessing with noise reduction and contrast enhancement</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: '#10b981' }}>✅</span>
              <span>Adaptive thresholding optimized for handwritten text</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: '#10b981' }}>✅</span>
              <span>Morphological operations to clean up character artifacts</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: '#10b981' }}>✅</span>
              <span>Enhanced OCR error correction for common handwriting mistakes</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: '#667eea' }}>🔍</span>
              <span>Multi-language support (English, Hindi, Arabic, Chinese)</span>
            </div>
          </div>
          
          <h4 style={{ margin: '0 0 1rem 0', color: '#667eea', fontSize: '1rem' }}>
            📝 Best Practices for Handwritten Text
          </h4>
          <div style={{ 
            background: 'white', 
            padding: '1rem', 
            borderRadius: '8px', 
            border: '1px solid #e2e8f0',
            fontSize: window.innerWidth <= 768 ? '0.75rem' : '0.8125rem'
          }}>
            <div style={{ color: '#667eea', fontWeight: '600', marginBottom: '0.5rem' }}>
              Writing Tips:
            </div>
            <div style={{ color: '#64748b', lineHeight: '1.5' }}>
              • Write clearly with good spacing between words<br/>
              • Use dark ink on light paper for best contrast<br/>
              • Avoid cursive writing - print letters work better<br/>
              • Keep text horizontal and avoid skewed writing<br/>
              • Use good lighting when taking the photo<br/>
              • Ensure the image is sharp and in focus
            </div>
          </div>
        </div>
        
        <ul style={{ 
          marginTop: '1.5rem',
          fontSize: window.innerWidth <= 768 ? '0.8125rem' : '0.875rem',
          lineHeight: '1.5'
        }}>
          <li>Choose the appropriate OCR mode for your text type</li>
          <li>Enable image enhancement options for better results</li>
          <li>The system automatically corrects common OCR errors</li>
          <li>Handwritten mode uses specialized algorithms for better accuracy</li>
          <li>Auto mode detects and processes both handwritten and printed text</li>
          <li>Location names are automatically geocoded to get coordinates</li>
        </ul>
      </div>
    </div>
  );
}

export default ImageOCRUpload;