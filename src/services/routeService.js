import { getRoadFollowingRoute } from './api.js';

/**
 * Route Service for handling road-following routes using Google Directions API
 */
class RouteService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Get road-following route between multiple stops
   * @param {Array} stops - Array of stop objects with latitude/longitude
   * @param {Object} options - Route options
   * @returns {Promise<Object>} Route data with road-following coordinates
   */
  async getRoadFollowingRoute(stops, options = {}) {
    if (!stops || stops.length < 2) {
      throw new Error('At least 2 stops are required for routing');
    }

    try {
      // Prepare waypoints for Google Directions API
      const origin = `${stops[0].latitude},${stops[0].longitude}`;
      const destination = `${stops[stops.length - 1].latitude},${stops[stops.length - 1].longitude}`;
      const waypoints = stops.slice(1, -1).map(stop => `${stop.latitude},${stop.longitude}`);

      // Check cache first
      const cacheKey = this.getCacheKey(origin, destination, waypoints, options);
      if (this.isCached(cacheKey)) {
        return this.getFromCache(cacheKey);
      }

      // Get road-following route from backend (which uses Google Directions API)
      const routeResult = await getRoadFollowingRoute(stops, {
        optimize: options.optimize || false,
        avoid: options.avoid || []
      });

      if (!routeResult.success) {
        throw new Error(routeResult.error || 'No routes found');
      }

      const result = {
        success: true,
        coordinates: routeResult.coordinates,
        totalDistance: routeResult.total_distance,
        totalDuration: routeResult.total_duration,
        durationInTraffic: routeResult.duration_in_traffic,
        legs: routeResult.legs,
        bounds: routeResult.bounds,
        overview_polyline: routeResult.overview_polyline
      };

      // Cache the result
      this.setCache(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Error getting road-following route:', error);
      
      // Fallback to straight-line route
      return {
        success: false,
        error: error.message,
        fallbackCoordinates: stops.map(stop => [parseFloat(stop.latitude), parseFloat(stop.longitude)])
      };
    }
  }

  /**
   * Get route between two points
   * @param {Object} start - Start point with latitude/longitude
   * @param {Object} end - End point with latitude/longitude
   * @param {Object} options - Route options
   * @returns {Promise<Object>} Route data
   */
  async getRouteSegment(start, end, options = {}) {
    return this.getRoadFollowingRoute([start, end], options);
  }

  /**
   * Format route data for display
   * @param {Object} routeData - Route data from backend
   * @returns {Object} Formatted route information
   */
  formatRouteInfo(routeData) {
    return {
      distance: `${(routeData.totalDistance / 1000).toFixed(1)} km`,
      duration: `${Math.round(routeData.totalDuration / 60)} min`,
      durationInTraffic: `${Math.round(routeData.durationInTraffic / 60)} min`,
      trafficDelay: routeData.durationInTraffic > routeData.totalDuration ?
        `+${Math.round((routeData.durationInTraffic - routeData.totalDuration) / 60)} min` :
        'No delays'
    };
  }

  /**
   * Cache management methods
   */
  getCacheKey(origin, destination, waypoints, options) {
    return `route_${origin}_${destination}_${waypoints.join('|')}_${JSON.stringify(options)}`;
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
    if (this.cache.size > 100) {
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

  /**
   * Clear all cached routes
   */
  clearCache() {
    this.cache.clear();
  }
}

// Create and export singleton instance
const routeService = new RouteService();
export default routeService;
