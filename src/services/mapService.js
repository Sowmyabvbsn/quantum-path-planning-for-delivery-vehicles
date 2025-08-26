import axios from 'axios';

// MapTiler is a free alternative to Mapbox with similar API
const MAPTILER_API_KEY = 'vHJf8GvATsvfzk13XzL0';
const MAPTILER_BASE_URL = 'https://api.maptiler.com';

// Fallback to OpenStreetMap if MapTiler is not available
const USE_MAPTILER = false; // Set to true when you have a MapTiler API key

class MapService {
  constructor() {
    this.apiKey = MAPTILER_API_KEY;
    this.baseUrl = MAPTILER_BASE_URL;
    this.tileCache = new Map();
    this.initialized = false;
  }

  // Initialize map service (called only once as per diagram)
  async initialize() {
    if (this.initialized) return;
    
    try {
      if (USE_MAPTILER && this.apiKey !== 'get_your_free_key_at_maptiler_com') {
        // Test MapTiler connection
        await this.testConnection();
        console.log('MapTiler service initialized successfully');
      } else {
        console.log('Using OpenStreetMap fallback service');
      }
      this.initialized = true;
    } catch (error) {
      console.warn('MapTiler initialization failed, falling back to OpenStreetMap:', error);
      this.initialized = true;
    }
  }

  async testConnection() {
    const response = await axios.get(`${this.baseUrl}/maps/streets/style.json?key=${this.apiKey}`);
    return response.status === 200;
  }

  // Get tile URL for map rendering
  getTileUrl(style = 'streets') {
    if (USE_MAPTILER && this.apiKey !== 'get_your_free_key_at_maptiler_com') {
      return `${this.baseUrl}/maps/${style}/{z}/{x}/{y}.png?key=${this.apiKey}`;
    } else {
      // Enhanced OpenStreetMap with better styling
      return 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
    }
  }

  // Get attribution text
  getAttribution() {
    if (USE_MAPTILER && this.apiKey !== 'get_your_free_key_at_maptiler_com') {
      return '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    } else {
      return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank">Humanitarian OpenStreetMap Team</a>';
    }
  }

  // Request tiles (only once as per diagram)
  async requestTiles(bounds, zoom) {
    const cacheKey = `${bounds.join(',')}-${zoom}`;
    
    if (this.tileCache.has(cacheKey)) {
      return this.tileCache.get(cacheKey);
    }

    try {
      const tileData = {
        url: this.getTileUrl(),
        attribution: this.getAttribution(),
        maxZoom: 19,
        tileSize: 256
      };

      this.tileCache.set(cacheKey, tileData);
      return tileData;
    } catch (error) {
      console.error('Error requesting tiles:', error);
      throw error;
    }
  }

  // Get geocoding service (alternative to Mapbox Geocoding)
  async geocodeAddress(address) {
    try {
      if (USE_MAPTILER && this.apiKey !== 'get_your_free_key_at_maptiler_com') {
        const response = await axios.get(`${this.baseUrl}/geocoding/${encodeURIComponent(address)}.json?key=${this.apiKey}`);
        return this.parseMapTilerGeocodingResponse(response.data);
      } else {
        // Use Nominatim (OpenStreetMap's geocoding service)
        const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=5`);
        return this.parseNominatimResponse(response.data);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      return [];
    }
  }

  // Reverse geocoding
  async reverseGeocode(lat, lng) {
    try {
      if (USE_MAPTILER && this.apiKey !== 'get_your_free_key_at_maptiler_com') {
        const response = await axios.get(`${this.baseUrl}/geocoding/${lng},${lat}.json?key=${this.apiKey}`);
        return this.parseMapTilerGeocodingResponse(response.data);
      } else {
        const response = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        return this.parseNominatimReverseResponse(response.data);
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  }

  parseMapTilerGeocodingResponse(data) {
    return data.features?.map(feature => ({
      name: feature.place_name || feature.text,
      latitude: feature.center[1],
      longitude: feature.center[0],
      address: feature.place_name,
      confidence: feature.relevance || 1
    })) || [];
  }

  parseNominatimResponse(data) {
    return data.map(item => ({
      name: item.display_name.split(',')[0],
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      address: item.display_name,
      confidence: parseFloat(item.importance) || 0.5
    }));
  }

  parseNominatimReverseResponse(data) {
    if (!data) return null;
    
    return {
      name: data.display_name.split(',')[0],
      latitude: parseFloat(data.lat),
      longitude: parseFloat(data.lon),
      address: data.display_name,
      confidence: parseFloat(data.importance) || 0.5
    };
  }

  // Get routing service (alternative to Mapbox Directions)
  async getRoute(coordinates, profile = 'driving') {
    try {
      if (USE_MAPTILER && this.apiKey !== 'get_your_free_key_at_maptiler_com') {
        // MapTiler doesn't have routing, so we'll use OSRM
        return await this.getOSRMRoute(coordinates, profile);
      } else {
        return await this.getOSRMRoute(coordinates, profile);
      }
    } catch (error) {
      console.error('Routing error:', error);
      return null;
    }
  }

  async getOSRMRoute(coordinates, profile) {
    const coordString = coordinates.map(coord => `${coord[1]},${coord[0]}`).join(';');
    const response = await axios.get(`https://router.project-osrm.org/route/v1/${profile}/${coordString}?overview=full&geometries=geojson`);
    
    if (response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      return {
        coordinates: route.geometry.coordinates.map(coord => [coord[1], coord[0]]), // Convert to [lat, lng]
        distance: route.distance / 1000, // Convert to km
        duration: route.duration / 60, // Convert to minutes
        geometry: route.geometry
      };
    }
    
    return null;
  }

  // Clear cache when needed
  clearCache() {
    this.tileCache.clear();
  }
}

export default new MapService();