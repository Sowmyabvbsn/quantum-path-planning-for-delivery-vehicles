import axios from 'axios';

// Multiple geocoding providers for better reliability
const GEOCODING_PROVIDERS = {
  NOMINATIM: {
    baseUrl: 'https://nominatim.openstreetmap.org',
    rateLimit: 1000, // 1 request per second
    free: true
  },
  MAPBOX: {
    baseUrl: 'https://api.mapbox.com/geocoding/v5/mapbox.places',
    apiKey: import.meta.env.REACT_APP_MAPBOX_API_KEY,
    rateLimit: 600, // 600 requests per minute
    free: false
  },
  OPENCAGE: {
    baseUrl: 'https://api.opencagedata.com/geocode/v1/json',
    apiKey: import.meta.env.VITE_OPENCAGE_API_KEY,
    rateLimit: 2500, // 2500 requests per day (free tier)
    free: true
  }
};

class GeocodingService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
    this.requestQueue = [];
    this.isProcessing = false;
    this.lastRequestTime = 0;
  }

  // Main geocoding function with fallback providers
  async geocodeLocation(locationName, options = {}) {
    if (!locationName || typeof locationName !== 'string') {
      throw new Error('Location name is required');
    }

    const cleanLocation = locationName.trim();
    if (cleanLocation.length === 0) {
      throw new Error('Location name cannot be empty');
    }

    // Check cache first
    const cacheKey = this.getCacheKey(cleanLocation, options);
    if (this.isCached(cacheKey)) {
      return this.getFromCache(cacheKey);
    }

    try {
      let result = null;
      
      // Try providers in order of preference
      const providers = this.getAvailableProviders();
      
      for (const provider of providers) {
        try {
          result = await this.geocodeWithProvider(cleanLocation, provider, options);
          if (result && result.length > 0) {
            // Cache successful result
            this.setCache(cacheKey, result);
            return result;
          }
        } catch (error) {
          console.warn(`Geocoding failed with ${provider}:`, error.message);
          continue;
        }
      }

      // If all providers fail, try fuzzy matching with cached results
      const fuzzyResult = this.fuzzyMatchFromCache(cleanLocation);
      if (fuzzyResult) {
        return fuzzyResult;
      }

      throw new Error(`No results found for location: ${cleanLocation}`);

    } catch (error) {
      console.error('Geocoding error:', error);
      throw error;
    }
  }

  // Reverse geocoding - convert coordinates to location name
  async reverseGeocode(latitude, longitude, options = {}) {
    if (!this.isValidCoordinate(latitude, longitude)) {
      throw new Error('Invalid coordinates provided');
    }

    const cacheKey = `reverse_${latitude}_${longitude}`;
    if (this.isCached(cacheKey)) {
      return this.getFromCache(cacheKey);
    }

    try {
      const providers = this.getAvailableProviders();
      
      for (const provider of providers) {
        try {
          const result = await this.reverseGeocodeWithProvider(latitude, longitude, provider, options);
          if (result) {
            this.setCache(cacheKey, result);
            return result;
          }
        } catch (error) {
          console.warn(`Reverse geocoding failed with ${provider}:`, error.message);
          continue;
        }
      }

      throw new Error(`No address found for coordinates: ${latitude}, ${longitude}`);

    } catch (error) {
      console.error('Reverse geocoding error:', error);
      throw error;
    }
  }

  // Geocode with Nominatim (OpenStreetMap)
  async geocodeWithNominatim(locationName, options = {}) {
    await this.respectRateLimit(GEOCODING_PROVIDERS.NOMINATIM.rateLimit);

    const params = {
      q: locationName,
      format: 'json',
      limit: options.limit || 5,
      addressdetails: 1,
      extratags: 1,
      namedetails: 1,
      'accept-language': options.language || 'en'
    };

    // Add country bias if specified
    if (options.countryCode) {
      params.countrycodes = options.countryCode;
    }

    // Add bounding box if specified
    if (options.bounds) {
      params.viewbox = `${options.bounds.west},${options.bounds.south},${options.bounds.east},${options.bounds.north}`;
      params.bounded = 1;
    }

    const response = await axios.get(`${GEOCODING_PROVIDERS.NOMINATIM.baseUrl}/search`, {
      params,
      headers: {
        'User-Agent': 'Quantum-Path-Planning-App/1.0'
      },
      timeout: 10000
    });

    return this.parseNominatimResponse(response.data);
  }

  // Geocode with Mapbox (if API key available)
  async geocodeWithMapbox(locationName, options = {}) {
    if (!GEOCODING_PROVIDERS.MAPBOX.apiKey) {
      throw new Error('Mapbox API key not configured');
    }

    const params = {
      access_token: GEOCODING_PROVIDERS.MAPBOX.apiKey,
      limit: options.limit || 5,
      language: options.language || 'en'
    };

    // Add country bias
    if (options.countryCode) {
      params.country = options.countryCode;
    }

    // Add proximity bias
    if (options.proximity) {
      params.proximity = `${options.proximity.longitude},${options.proximity.latitude}`;
    }

    const encodedLocation = encodeURIComponent(locationName);
    const response = await axios.get(
      `${GEOCODING_PROVIDERS.MAPBOX.baseUrl}/${encodedLocation}.json`,
      { params, timeout: 10000 }
    );

    return this.parseMapboxResponse(response.data);
  }

  // Geocode with OpenCage (if API key available)
  async geocodeWithOpenCage(locationName, options = {}) {
    if (!GEOCODING_PROVIDERS.OPENCAGE.apiKey) {
      throw new Error('OpenCage API key not configured');
    }

    const params = {
      key: GEOCODING_PROVIDERS.OPENCAGE.apiKey,
      q: locationName,
      limit: options.limit || 5,
      language: options.language || 'en',
      pretty: 1,
      no_annotations: 0
    };

    // Add country bias
    if (options.countryCode) {
      params.countrycode = options.countryCode;
    }

    // Add bounding box
    if (options.bounds) {
      params.bounds = `${options.bounds.west},${options.bounds.south},${options.bounds.east},${options.bounds.north}`;
    }

    const response = await axios.get(GEOCODING_PROVIDERS.OPENCAGE.baseUrl, {
      params,
      timeout: 10000
    });

    return this.parseOpenCageResponse(response.data);
  }

  // Generic geocoding with provider selection
  async geocodeWithProvider(locationName, provider, options = {}) {
    switch (provider) {
      case 'nominatim':
        return await this.geocodeWithNominatim(locationName, options);
      case 'mapbox':
        return await this.geocodeWithMapbox(locationName, options);
      case 'opencage':
        return await this.geocodeWithOpenCage(locationName, options);
      default:
        throw new Error(`Unknown geocoding provider: ${provider}`);
    }
  }

  // Reverse geocoding with Nominatim
  async reverseGeocodeWithNominatim(latitude, longitude, options = {}) {
    await this.respectRateLimit(GEOCODING_PROVIDERS.NOMINATIM.rateLimit);

    const params = {
      lat: latitude,
      lon: longitude,
      format: 'json',
      addressdetails: 1,
      zoom: options.zoom || 18,
      'accept-language': options.language || 'en'
    };

    const response = await axios.get(`${GEOCODING_PROVIDERS.NOMINATIM.baseUrl}/reverse`, {
      params,
      headers: {
        'User-Agent': 'Quantum-Path-Planning-App/1.0'
      },
      timeout: 10000
    });

    return this.parseNominatimReverseResponse(response.data);
  }

  // Generic reverse geocoding
  async reverseGeocodeWithProvider(latitude, longitude, provider, options = {}) {
    switch (provider) {
      case 'nominatim':
        return await this.reverseGeocodeWithNominatim(latitude, longitude, options);
      // Add other providers as needed
      default:
        throw new Error(`Reverse geocoding not implemented for provider: ${provider}`);
    }
  }

  // Parse Nominatim response
  parseNominatimResponse(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    return data.map(item => ({
      name: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      confidence: this.calculateNominatimConfidence(item),
      type: item.type,
      category: item.class,
      address: this.parseNominatimAddress(item.address),
      boundingBox: item.boundingbox ? {
        north: parseFloat(item.boundingbox[1]),
        south: parseFloat(item.boundingbox[0]),
        east: parseFloat(item.boundingbox[3]),
        west: parseFloat(item.boundingbox[2])
      } : null,
      provider: 'nominatim',
      raw: item
    }));
  }

  // Parse Mapbox response
  parseMapboxResponse(data) {
    if (!data.features || data.features.length === 0) {
      return [];
    }

    return data.features.map(feature => ({
      name: feature.place_name,
      latitude: feature.center[1],
      longitude: feature.center[0],
      confidence: feature.relevance || 0.5,
      type: feature.place_type?.[0] || 'unknown',
      category: feature.properties?.category || 'place',
      address: this.parseMapboxAddress(feature),
      boundingBox: feature.bbox ? {
        west: feature.bbox[0],
        south: feature.bbox[1],
        east: feature.bbox[2],
        north: feature.bbox[3]
      } : null,
      provider: 'mapbox',
      raw: feature
    }));
  }

  // Parse OpenCage response
  parseOpenCageResponse(data) {
    if (!data.results || data.results.length === 0) {
      return [];
    }

    return data.results.map(result => ({
      name: result.formatted,
      latitude: result.geometry.lat,
      longitude: result.geometry.lng,
      confidence: result.confidence / 10, // Convert to 0-1 scale
      type: result.components._type || 'unknown',
      category: result.components._category || 'place',
      address: this.parseOpenCageAddress(result.components),
      boundingBox: result.bounds ? {
        north: result.bounds.northeast.lat,
        south: result.bounds.southwest.lat,
        east: result.bounds.northeast.lng,
        west: result.bounds.southwest.lng
      } : null,
      provider: 'opencage',
      raw: result
    }));
  }

  // Parse Nominatim reverse response
  parseNominatimReverseResponse(data) {
    if (!data || !data.display_name) {
      return null;
    }

    return {
      name: data.display_name,
      address: this.parseNominatimAddress(data.address),
      provider: 'nominatim',
      raw: data
    };
  }

  // Helper methods
  parseNominatimAddress(address) {
    if (!address) return {};
    
    return {
      houseNumber: address.house_number,
      street: address.road || address.street,
      neighborhood: address.neighbourhood || address.suburb,
      city: address.city || address.town || address.village,
      county: address.county,
      state: address.state,
      country: address.country,
      postcode: address.postcode
    };
  }

  parseMapboxAddress(feature) {
    const context = feature.context || [];
    const address = {};

    context.forEach(item => {
      const id = item.id.split('.')[0];
      switch (id) {
        case 'postcode':
          address.postcode = item.text;
          break;
        case 'place':
          address.city = item.text;
          break;
        case 'region':
          address.state = item.text;
          break;
        case 'country':
          address.country = item.text;
          break;
      }
    });

    return address;
  }

  parseOpenCageAddress(components) {
    return {
      houseNumber: components.house_number,
      street: components.road || components.street,
      neighborhood: components.neighbourhood || components.suburb,
      city: components.city || components.town || components.village,
      county: components.county,
      state: components.state,
      country: components.country,
      postcode: components.postcode
    };
  }

  calculateNominatimConfidence(item) {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence based on item properties
    if (item.importance) confidence += item.importance * 0.3;
    if (item.type === 'city' || item.type === 'town') confidence += 0.2;
    if (item.class === 'place') confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  // Get available providers based on API key configuration
  getAvailableProviders() {
    const providers = ['nominatim']; // Always available
    
    if (GEOCODING_PROVIDERS.MAPBOX.apiKey) {
      providers.unshift('mapbox'); // Prefer Mapbox if available
    }
    
    if (GEOCODING_PROVIDERS.OPENCAGE.apiKey) {
      providers.push('opencage');
    }
    
    return providers;
  }

  // Rate limiting
  async respectRateLimit(minInterval) {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  // Cache management
  getCacheKey(location, options) {
    return `geocode_${location}_${JSON.stringify(options)}`;
  }

  isCached(key) {
    const cached = this.cache.get(key);
    return cached && (Date.now() - cached.timestamp) < this.cacheTimeout;
  }

  getFromCache(key) {
    return this.cache.get(key)?.data || null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // Fuzzy matching for cached results
  fuzzyMatchFromCache(locationName) {
    const normalizedInput = locationName.toLowerCase().trim();
    
    for (const [key, cached] of this.cache.entries()) {
      if (key.startsWith('geocode_')) {
        const cachedLocation = key.split('_')[1].toLowerCase();
        if (this.calculateSimilarity(normalizedInput, cachedLocation) > 0.8) {
          return cached.data;
        }
      }
    }
    
    return null;
  }

  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Validation
  isValidCoordinate(latitude, longitude) {
    return !isNaN(latitude) && !isNaN(longitude) &&
           latitude >= -90 && latitude <= 90 &&
           longitude >= -180 && longitude <= 180;
  }

  // Batch geocoding for multiple locations
  async batchGeocode(locations, options = {}) {
    const results = [];
    const batchSize = options.batchSize || 5;
    const delay = options.delay || 1000;

    for (let i = 0; i < locations.length; i += batchSize) {
      const batch = locations.slice(i, i + batchSize);
      const batchPromises = batch.map(location => 
        this.geocodeLocation(location, options).catch(error => ({
          error: error.message,
          location
        }))
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches to respect rate limits
      if (i + batchSize < locations.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return results;
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Create and export singleton instance
const geocodingService = new GeocodingService();
export default geocodingService;

// Export individual functions for convenience
export const {
  geocodeLocation,
  reverseGeocode,
  batchGeocode,
  clearCache,
  getCacheStats
} = geocodingService;