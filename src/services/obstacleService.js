import axios from 'axios';

// Google Cloud APIs configuration
const GOOGLE_CLOUD_CONFIG = {
  MAPS: {
    baseUrl: 'https://maps.googleapis.com/maps/api',
    apiKey: 'AIzaSyD4N9C7tE_VFlPUjVaAOdSQZNoGO9OTM7w'
  },
  ROADS: {
    baseUrl: 'https://roads.googleapis.com/v1',
    apiKey: 'AIzaSyD4N9C7tE_VFlPUjVaAOdSQZNoGO9OTM7w'
  },
  PLACES: {
    baseUrl: 'https://maps.googleapis.com/maps/api/place',
    apiKey: 'AIzaSyD4N9C7tE_VFlPUjVaAOdSQZNoGO9OTM7w'
  }
};

class ObstacleDetectionService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; 
    this.requestQueue = [];
    this.isProcessing = false;
  }
  // Main method to get route obstacles using Google Cloud APIs
  async getRouteObstacles(coordinates, options = {}) {
    try {
      const obstacles = await Promise.allSettled([
        this.getGoogleTrafficObstacles(coordinates),
        this.getGooglePlacesObstacles(coordinates),
        this.getGoogleRoadsObstacles(coordinates)
      ]);

      const allObstacles = obstacles
        .filter(result => result.status === 'fulfilled')
        .flatMap(result => result.value)
        .filter(obstacle => obstacle && obstacle.severity > 0.3);

      // Sort by severity and proximity
      return this.prioritizeObstacles(allObstacles, coordinates);
    } catch (error) {
      console.error('Error fetching route obstacles:', error);
      return this.getSimulatedObstacles(coordinates);
    }
  }

  // Google Maps Traffic API integration
  async getGoogleTrafficObstacles(coordinates) {
    const obstacles = [];

    try {
      // Create path from coordinates for traffic analysis
      const path = coordinates.map(coord => `${coord[0]},${coord[1]}`).join('|');

      const response = await axios.get(`${GOOGLE_CLOUD_CONFIG.MAPS.baseUrl}/directions/json`, {
        params: {
          origin: `${coordinates[0][0]},${coordinates[0][1]}`,
          destination: `${coordinates[coordinates.length - 1][0]},${coordinates[coordinates.length - 1][1]}`,
          waypoints: coordinates.slice(1, -1).map(coord => `${coord[0]},${coord[1]}`).join('|'),
          departure_time: 'now',
          traffic_model: 'best_guess',
          key: GOOGLE_CLOUD_CONFIG.MAPS.apiKey
        },
        timeout: 10000
      });

      if (response.data.status === 'OK' && response.data.routes.length > 0) {
        const route = response.data.routes[0];

        // Analyze legs for traffic conditions
        route.legs.forEach((leg, index) => {
          if (leg.duration_in_traffic && leg.duration) {
            const trafficDelay = leg.duration_in_traffic.value - leg.duration.value;

            if (trafficDelay > 300) { // More than 5 minutes delay
              obstacles.push({
                type: 'traffic',
                severity: Math.min(trafficDelay / 1800, 1.0), // Normalize to 0-1 (30 min max)
                location: {
                  latitude: leg.start_location.lat,
                  longitude: leg.start_location.lng
                },
                description: `Heavy traffic causing ${Math.round(trafficDelay / 60)} minute delay`,
                duration: trafficDelay,
                source: 'Google Maps Traffic'
              });
            }
          }
        });
      }
    } catch (error) {
      console.warn('Google Traffic API error:', error.message);
      return this.getSimulatedTrafficObstacles(coordinates);
    }

    return obstacles;
  }

  // Google Places API for event and construction obstacles
  async getGooglePlacesObstacles(coordinates) {
    const obstacles = [];

    try {
      // Search for construction, events, and other obstacles near route
      const center = this.calculateCenter(coordinates);
      const radius = this.calculateRadius(coordinates);

      const searchTypes = ['construction_site', 'hospital', 'school', 'stadium'];

      for (const type of searchTypes) {
        const response = await axios.get(`${GOOGLE_CLOUD_CONFIG.PLACES.baseUrl}/nearbysearch/json`, {
          params: {
            location: `${center.lat},${center.lng}`,
            radius: Math.min(radius, 50000), // Max 50km radius
            type: type,
            key: GOOGLE_CLOUD_CONFIG.PLACES.apiKey
          },
          timeout: 10000
        });

        if (response.data.status === 'OK') {
          response.data.results.forEach(place => {
            let severity = 0.4; // Base severity
            let description = `${type.replace('_', ' ')} nearby`;

            // Adjust severity based on place type
            if (type === 'construction_site') {
              severity = 0.8;
              description = 'Construction work may cause delays';
            } else if (type === 'stadium') {
              severity = 0.6;
              description = 'Stadium events may cause traffic';
            } else if (type === 'school') {
              severity = 0.5;
              description = 'School zone - reduced speed limits';
            } else if (type === 'hospital') {
              severity = 0.3;
              description = 'Hospital zone - emergency vehicles';
            }

            obstacles.push({
              type: type,
              severity: severity,
              location: {
                latitude: place.geometry.location.lat,
                longitude: place.geometry.location.lng
              },
              description: description,
              name: place.name,
              rating: place.rating,
              source: 'Google Places'
            });
          });
        }

        // Rate limiting
        await this.delay(100);
      }
    } catch (error) {
      console.warn('Google Places API error:', error.message);
      return this.getSimulatedPlacesObstacles(coordinates);
    }

    return obstacles;
  }

  // Google Roads API for road conditions and speed limits
  async getGoogleRoadsObstacles(coordinates) {
    const obstacles = [];

    try {
      // Snap coordinates to roads and get road information
      const path = coordinates.map(coord => `${coord[0]},${coord[1]}`).join('|');

      const response = await axios.get(`${GOOGLE_CLOUD_CONFIG.ROADS.baseUrl}/snapToRoads`, {
        params: {
          path: path,
          interpolate: true,
          key: GOOGLE_CLOUD_CONFIG.ROADS.apiKey
        },
        timeout: 10000
      });

      if (response.data.snappedPoints) {
        // Get speed limits for snapped points
        const placeIds = response.data.snappedPoints
          .filter(point => point.placeId)
          .map(point => point.placeId)
          .slice(0, 100); // Limit to 100 requests

        if (placeIds.length > 0) {
          const speedResponse = await axios.get(`${GOOGLE_CLOUD_CONFIG.ROADS.baseUrl}/speedLimits`, {
            params: {
              placeIds: placeIds.join(','),
              key: GOOGLE_CLOUD_CONFIG.ROADS.apiKey
            },
            timeout: 10000
          });

          if (speedResponse.data.speedLimits) {
            speedResponse.data.speedLimits.forEach((speedLimit, index) => {
              const snappedPoint = response.data.snappedPoints[index];

              // Create obstacles for low speed limit areas
              if (speedLimit.speedLimit && speedLimit.speedLimit <= 30) {
                obstacles.push({
                  type: 'speed_limit',
                  severity: 0.4,
                  location: {
                    latitude: snappedPoint.location.latitude,
                    longitude: snappedPoint.location.longitude
                  },
                  description: `Speed limit: ${speedLimit.speedLimit} ${speedLimit.units}`,
                  speedLimit: speedLimit.speedLimit,
                  units: speedLimit.units,
                  source: 'Google Roads'
                });
              }
            });
          }
        }
      }
    } catch (error) {
      console.warn('Google Roads API error:', error.message);
      return this.getSimulatedRoadObstacles(coordinates);
    }

    return obstacles;
  }

  // Simulation methods for fallback when APIs fail
  getSimulatedObstacles(coordinates) {
    return [
      ...this.getSimulatedTrafficObstacles(coordinates),
      ...this.getSimulatedPlacesObstacles(coordinates),
      ...this.getSimulatedRoadObstacles(coordinates)
    ];
  }

  getSimulatedTrafficObstacles(coordinates) {
    const obstacles = [];

    // Add some random traffic obstacles
    coordinates.forEach((coord, index) => {
      if (Math.random() > 0.7) { // 30% chance of traffic
        obstacles.push({
          type: 'traffic',
          severity: 0.3 + Math.random() * 0.4, // 0.3 to 0.7
          location: {
            latitude: coord[0] + (Math.random() - 0.5) * 0.01,
            longitude: coord[1] + (Math.random() - 0.5) * 0.01
          },
          description: 'Simulated traffic congestion',
          duration: 300 + Math.random() * 1200, // 5-25 minutes
          source: 'Simulation'
        });
      }
    });

    return obstacles;
  }

  getSimulatedPlacesObstacles(coordinates) {
    const obstacles = [];
    const center = this.calculateCenter(coordinates);

    // Add some simulated places obstacles
    const placeTypes = ['school', 'hospital', 'construction_site'];
    placeTypes.forEach(type => {
      if (Math.random() > 0.8) { // 20% chance
        obstacles.push({
          type: type,
          severity: type === 'construction_site' ? 0.8 : 0.4,
          location: {
            latitude: center.lat + (Math.random() - 0.5) * 0.02,
            longitude: center.lng + (Math.random() - 0.5) * 0.02
          },
          description: `Simulated ${type.replace('_', ' ')}`,
          source: 'Simulation'
        });
      }
    });

    return obstacles;
  }

  getSimulatedRoadObstacles(coordinates) {
    const obstacles = [];

    // Add some speed limit obstacles
    coordinates.forEach((coord, index) => {
      if (Math.random() > 0.9) { // 10% chance
        obstacles.push({
          type: 'speed_limit',
          severity: 0.3,
          location: {
            latitude: coord[0],
            longitude: coord[1]
          },
          description: 'Simulated low speed zone',
          speedLimit: 25 + Math.random() * 15, // 25-40 km/h
          source: 'Simulation'
        });
      }
    });

    return obstacles;
  }

  // Utility methods
  calculateCenter(coordinates) {
    const lats = coordinates.map(coord => coord[0]);
    const lngs = coordinates.map(coord => coord[1]);

    return {
      lat: lats.reduce((sum, lat) => sum + lat, 0) / lats.length,
      lng: lngs.reduce((sum, lng) => sum + lng, 0) / lngs.length
    };
  }

  calculateRadius(coordinates) {
    const center = this.calculateCenter(coordinates);
    let maxDistance = 0;

    coordinates.forEach(coord => {
      const distance = this.calculateDistance(center.lat, center.lng, coord[0], coord[1]);
      if (distance > maxDistance) {
        maxDistance = distance;
      }
    });

    return Math.max(maxDistance * 1000, 5000); // At least 5km radius
  }

  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  prioritizeObstacles(obstacles, coordinates) {
    const center = this.calculateCenter(coordinates);

    return obstacles
      .map(obstacle => ({
        ...obstacle,
        distance: this.calculateDistance(
          center.lat, center.lng,
          obstacle.location.latitude, obstacle.location.longitude
        )
      }))
      .sort((a, b) => {
        // Sort by severity first, then by distance
        if (a.severity !== b.severity) {
          return b.severity - a.severity;
        }
        return a.distance - b.distance;
      })
      .slice(0, 20); // Limit to top 20 obstacles
  }

  // Cache management methods
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
  }

  // Utility delay method
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create and export a singleton instance
const obstacleService = new ObstacleDetectionService();
export default obstacleService;