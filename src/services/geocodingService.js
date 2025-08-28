import axios from 'axios';

// Google Cloud APIs configuration
const GOOGLE_CLOUD_CONFIG = {
  GEOCODING: {
    baseUrl: 'https://maps.googleapis.com/maps/api/geocode/json',
    apiKey: 'AIzaSyD4N9C7tE_VFlPUjVaAOdSQZNoGO9OTM7w',
    rateLimit: 50000, // 50,000 requests per day
    premium: true
  },
  PLACES: {
    baseUrl: 'https://maps.googleapis.com/maps/api/place',
    apiKey: 'AIzaSyD4N9C7tE_VFlPUjVaAOdSQZNoGO9OTM7w',
    rateLimit: 100000, // 100,000 requests per day
    premium: true
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

  // Main geocoding function using Google Cloud Geocoding API
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
      // Use Google Cloud Geocoding API
      const result = await this.geocodeWithGoogle(cleanLocation, options);

      if (result && result.length > 0) {
        // Cache successful result
        this.setCache(cacheKey, result);
        return result;
      }

      // If no results, try fuzzy matching with cached results
      const fuzzyResult = this.fuzzyMatchFromCache(cleanLocation);
      if (fuzzyResult) {
        return fuzzyResult;
      }

      throw new Error(`No results found for location: ${cleanLocation}`);

    } catch (error) {
      console.error('Google Geocoding error:', error);
      throw error;
    }
  }

  // Google Cloud Geocoding API implementation
  async geocodeWithGoogle(locationName, options = {}) {
    const params = {
      address: locationName,
      key: GOOGLE_CLOUD_CONFIG.GEOCODING.apiKey,
      language: options.language || 'en'
    };

    // Add region bias if specified
    if (options.region) {
      params.region = options.region;
    }

    // Add bounds if specified
    if (options.bounds) {
      params.bounds = `${options.bounds.south},${options.bounds.west}|${options.bounds.north},${options.bounds.east}`;
    }

    // Add component restrictions (country, etc.)
    if (options.components) {
      params.components = Object.entries(options.components)
        .map(([key, value]) => `${key}:${value}`)
        .join('|');
    }

    const response = await axios.get(GOOGLE_CLOUD_CONFIG.GEOCODING.baseUrl, {
      params,
      timeout: 10000
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Google Geocoding API error: ${response.data.status} - ${response.data.error_message || 'Unknown error'}`);
    }

    return this.parseGoogleGeocodingResults(response.data.results);
  }

  // Reverse geocoding using Google Cloud Geocoding API
  async reverseGeocode(latitude, longitude, options = {}) {
    if (!this.isValidCoordinate(latitude, longitude)) {
      throw new Error('Invalid coordinates provided');
    }

    const cacheKey = `reverse_${latitude}_${longitude}`;
    if (this.isCached(cacheKey)) {
      return this.getFromCache(cacheKey);
    }

    try {
      const result = await this.reverseGeocodeWithGoogle(latitude, longitude, options);

      if (result) {
        this.setCache(cacheKey, result);
        return result;
      }

      throw new Error(`No results found for coordinates: ${latitude}, ${longitude}`);

    } catch (error) {
      console.error('Google Reverse Geocoding error:', error);
      throw error;
    }
  }

  // Google Cloud Reverse Geocoding implementation
  async reverseGeocodeWithGoogle(latitude, longitude, options = {}) {
    const params = {
      latlng: `${latitude},${longitude}`,
      key: GOOGLE_CLOUD_CONFIG.GEOCODING.apiKey,
      language: options.language || 'en'
    };

    // Add result type filters if specified
    if (options.result_type) {
      params.result_type = Array.isArray(options.result_type)
        ? options.result_type.join('|')
        : options.result_type;
    }

    // Add location type filters if specified
    if (options.location_type) {
      params.location_type = Array.isArray(options.location_type)
        ? options.location_type.join('|')
        : options.location_type;
    }

    const response = await axios.get(GOOGLE_CLOUD_CONFIG.GEOCODING.baseUrl, {
      params,
      timeout: 10000
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Google Reverse Geocoding API error: ${response.data.status} - ${response.data.error_message || 'Unknown error'}`);
    }

    return this.parseGoogleReverseGeocodingResults(response.data.results);
  }

  // Parse Google Geocoding API results
  parseGoogleGeocodingResults(results) {
    return results.map(result => ({
      name: result.formatted_address,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      confidence: this.calculateGoogleConfidence(result),
      type: this.getGooglePlaceType(result.types),
      components: this.parseGoogleAddressComponents(result.address_components),
      place_id: result.place_id,
      viewport: result.geometry.viewport,
      location_type: result.geometry.location_type
    }));
  }

  // Parse Google Reverse Geocoding API results
  parseGoogleReverseGeocodingResults(results) {
    if (!results || results.length === 0) {
      return null;
    }

    const result = results[0]; // Take the most relevant result
    return {
      name: result.formatted_address,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      components: this.parseGoogleAddressComponents(result.address_components),
      place_id: result.place_id,
      types: result.types
    };
  }

  // Helper methods for Google API results parsing
  calculateGoogleConfidence(result) {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on location type
    if (result.geometry.location_type === 'ROOFTOP') confidence += 0.4;
    else if (result.geometry.location_type === 'RANGE_INTERPOLATED') confidence += 0.3;
    else if (result.geometry.location_type === 'GEOMETRIC_CENTER') confidence += 0.2;
    else if (result.geometry.location_type === 'APPROXIMATE') confidence += 0.1;

    // Increase confidence based on place types
    if (result.types.includes('street_address')) confidence += 0.3;
    else if (result.types.includes('premise')) confidence += 0.25;
    else if (result.types.includes('subpremise')) confidence += 0.2;
    else if (result.types.includes('locality')) confidence += 0.15;

    return Math.min(confidence, 1.0);
  }

  getGooglePlaceType(types) {
    const typeMapping = {
      'street_address': 'address',
      'route': 'street',
      'locality': 'city',
      'administrative_area_level_1': 'state',
      'country': 'country',
      'postal_code': 'postcode',
      'point_of_interest': 'poi'
    };

    for (const type of types) {
      if (typeMapping[type]) {
        return typeMapping[type];
      }
    }

    return types[0] || 'unknown';
  }

  parseGoogleAddressComponents(components) {
    const parsed = {};

    components.forEach(component => {
      const types = component.types;
      const value = component.long_name;
      const shortValue = component.short_name;

      if (types.includes('street_number')) parsed.street_number = value;
      if (types.includes('route')) parsed.street = value;
      if (types.includes('locality')) parsed.city = value;
      if (types.includes('administrative_area_level_1')) {
        parsed.state = value;
        parsed.state_code = shortValue;
      }
      if (types.includes('country')) {
        parsed.country = value;
        parsed.country_code = shortValue;
      }
      if (types.includes('postal_code')) parsed.postcode = value;
    });

    return parsed;
  }

  // Cache management methods
  getCacheKey(location, options) {
    return `${location}_${JSON.stringify(options)}`;
  }

  isCached(key) {
    const cached = this.cache.get(key);
    if (!cached) return false;

    const now = Date.now();
    if (now - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    return cached ? cached.data : null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Clean old cache entries periodically
    if (this.cache.size > 1000) {
      this.cleanCache();
    }
  }

  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }

  // Utility methods
  isValidCoordinate(latitude, longitude) {
    return (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180 &&
      !isNaN(latitude) &&
      !isNaN(longitude)
    );
  }

  // Fuzzy matching from cache for fallback
  fuzzyMatchFromCache(locationName) {
    const searchTerm = locationName.toLowerCase();

    for (const [key, value] of this.cache.entries()) {
      if (key.toLowerCase().includes(searchTerm) || searchTerm.includes(key.toLowerCase())) {
        const now = Date.now();
        if (now - value.timestamp <= this.cacheTimeout) {
          return value.data;
        }
      }
    }

    return null;
  }

  // Places API search for enhanced results
  async searchPlaces(query, options = {}) {
    const params = {
      query: query,
      key: GOOGLE_CLOUD_CONFIG.PLACES.apiKey,
      language: options.language || 'en'
    };

    // Add location bias if specified
    if (options.location) {
      params.location = `${options.location.lat},${options.location.lng}`;
      params.radius = options.radius || 50000; // 50km default radius
    }

    // Add type filter if specified
    if (options.type) {
      params.type = options.type;
    }

    const response = await axios.get(`${GOOGLE_CLOUD_CONFIG.PLACES.baseUrl}/textsearch/json`, {
      params,
      timeout: 10000
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Google Places API error: ${response.data.status} - ${response.data.error_message || 'Unknown error'}`);
    }

    return this.parseGooglePlacesResults(response.data.results);
  }

  // Parse Google Places API results
  parseGooglePlacesResults(results) {
    return results.map(result => ({
      name: result.name,
      formatted_address: result.formatted_address,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      place_id: result.place_id,
      types: result.types,
      rating: result.rating,
      price_level: result.price_level,
      photos: result.photos ? result.photos.map(photo => ({
        photo_reference: photo.photo_reference,
        width: photo.width,
        height: photo.height
      })) : []
    }));
  }
}

// Create and export a singleton instance
const geocodingService = new GeocodingService();
export default geocodingService;