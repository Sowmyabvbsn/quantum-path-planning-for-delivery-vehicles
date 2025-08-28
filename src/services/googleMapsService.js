import axios from 'axios';

// Google Maps JavaScript API configuration
const GOOGLE_MAPS_CONFIG = {
  apiKey: 'AIzaSyD4N9C7tE_VFlPUjVaAOdSQZNoGO9OTM7w',
  libraries: ['places', 'geometry', 'directions'],
  version: 'weekly'
};

class GoogleMapsService {
  constructor() {
    this.isLoaded = false;
    this.loadPromise = null;
    this.directionsService = null;
    this.placesService = null;
  }

  // Load Google Maps JavaScript API
  async loadGoogleMaps() {
    if (this.isLoaded) {
      return window.google;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.google && window.google.maps) {
        this.isLoaded = true;
        this.initializeServices();
        resolve(window.google);
        return;
      }

      // Create script element
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_CONFIG.apiKey}&libraries=${GOOGLE_MAPS_CONFIG.libraries.join(',')}&v=${GOOGLE_MAPS_CONFIG.version}`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        this.isLoaded = true;
        this.initializeServices();
        resolve(window.google);
      };

      script.onerror = (error) => {
        reject(new Error('Failed to load Google Maps API'));
      };

      document.head.appendChild(script);
    });

    return this.loadPromise;
  }

  // Initialize Google Maps services
  initializeServices() {
    if (window.google && window.google.maps) {
      this.directionsService = new window.google.maps.DirectionsService();
      // PlacesService needs a map instance, will be initialized when needed
    }
  }

  // Get directions with traffic information
  async getDirections(origin, destination, waypoints = [], options = {}) {
    await this.loadGoogleMaps();

    return new Promise((resolve, reject) => {
      const request = {
        origin: origin,
        destination: destination,
        waypoints: waypoints.map(wp => ({ location: wp, stopover: true })),
        travelMode: window.google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: window.google.maps.TrafficModel.BEST_GUESS
        },
        optimizeWaypoints: options.optimize || false,
        avoidHighways: options.avoidHighways || false,
        avoidTolls: options.avoidTolls || false
      };

      this.directionsService.route(request, (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          resolve(result);
        } else {
          reject(new Error(`Directions request failed: ${status}`));
        }
      });
    });
  }

  // Search for places near a location
  async searchNearbyPlaces(location, radius = 5000, types = []) {
    await this.loadGoogleMaps();

    return new Promise((resolve, reject) => {
      // Create a temporary map element for PlacesService
      const mapDiv = document.createElement('div');
      const map = new window.google.maps.Map(mapDiv);
      const service = new window.google.maps.places.PlacesService(map);

      const request = {
        location: new window.google.maps.LatLng(location.lat, location.lng),
        radius: radius,
        types: types
      };

      service.nearbySearch(request, (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          resolve(results);
        } else {
          reject(new Error(`Places search failed: ${status}`));
        }
      });
    });
  }

  // Get place details
  async getPlaceDetails(placeId) {
    await this.loadGoogleMaps();

    return new Promise((resolve, reject) => {
      const mapDiv = document.createElement('div');
      const map = new window.google.maps.Map(mapDiv);
      const service = new window.google.maps.places.PlacesService(map);

      const request = {
        placeId: placeId,
        fields: ['name', 'formatted_address', 'geometry', 'types', 'rating', 'photos']
      };

      service.getDetails(request, (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          resolve(place);
        } else {
          reject(new Error(`Place details request failed: ${status}`));
        }
      });
    });
  }

  // Calculate distance matrix
  async getDistanceMatrix(origins, destinations, options = {}) {
    await this.loadGoogleMaps();

    return new Promise((resolve, reject) => {
      const service = new window.google.maps.DistanceMatrixService();

      const request = {
        origins: origins,
        destinations: destinations,
        travelMode: window.google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: window.google.maps.TrafficModel.BEST_GUESS
        },
        avoidHighways: options.avoidHighways || false,
        avoidTolls: options.avoidTolls || false
      };

      service.getDistanceMatrix(request, (response, status) => {
        if (status === window.google.maps.DistanceMatrixStatus.OK) {
          resolve(response);
        } else {
          reject(new Error(`Distance matrix request failed: ${status}`));
        }
      });
    });
  }

  // Geocode an address
  async geocodeAddress(address) {
    await this.loadGoogleMaps();

    return new Promise((resolve, reject) => {
      const geocoder = new window.google.maps.Geocoder();

      geocoder.geocode({ address: address }, (results, status) => {
        if (status === window.google.maps.GeocoderStatus.OK) {
          resolve(results);
        } else {
          reject(new Error(`Geocoding failed: ${status}`));
        }
      });
    });
  }

  // Reverse geocode coordinates
  async reverseGeocode(lat, lng) {
    await this.loadGoogleMaps();

    return new Promise((resolve, reject) => {
      const geocoder = new window.google.maps.Geocoder();
      const latlng = new window.google.maps.LatLng(lat, lng);

      geocoder.geocode({ location: latlng }, (results, status) => {
        if (status === window.google.maps.GeocoderStatus.OK) {
          resolve(results);
        } else {
          reject(new Error(`Reverse geocoding failed: ${status}`));
        }
      });
    });
  }

  // Calculate route with traffic optimization
  async calculateOptimizedRoute(stops, startIndex = 0) {
    try {
      const origin = stops[startIndex];
      const destination = stops[startIndex]; // Return to start
      const waypoints = stops.filter((_, index) => index !== startIndex);

      const result = await this.getDirections(
        `${origin.latitude},${origin.longitude}`,
        `${destination.latitude},${destination.longitude}`,
        waypoints.map(stop => `${stop.latitude},${stop.longitude}`),
        { optimize: true }
      );

      return {
        success: true,
        route: result.routes[0],
        optimizedOrder: result.routes[0].waypoint_order,
        totalDistance: result.routes[0].legs.reduce((sum, leg) => sum + leg.distance.value, 0),
        totalDuration: result.routes[0].legs.reduce((sum, leg) => sum + leg.duration.value, 0),
        durationInTraffic: result.routes[0].legs.reduce((sum, leg) => sum + (leg.duration_in_traffic?.value || leg.duration.value), 0)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get traffic information for a route
  async getTrafficInfo(coordinates) {
    try {
      const origin = coordinates[0];
      const destination = coordinates[coordinates.length - 1];
      const waypoints = coordinates.slice(1, -1);

      const result = await this.getDirections(
        `${origin[0]},${origin[1]}`,
        `${destination[0]},${destination[1]}`,
        waypoints.map(coord => `${coord[0]},${coord[1]}`)
      );

      const trafficObstacles = [];
      
      result.routes[0].legs.forEach((leg, index) => {
        if (leg.duration_in_traffic && leg.duration) {
          const delay = leg.duration_in_traffic.value - leg.duration.value;
          
          if (delay > 300) { // More than 5 minutes delay
            trafficObstacles.push({
              type: 'traffic',
              severity: Math.min(delay / 1800, 1.0), // Normalize to 0-1
              location: {
                latitude: leg.start_location.lat(),
                longitude: leg.start_location.lng()
              },
              description: `Traffic delay: ${Math.round(delay / 60)} minutes`,
              duration: delay,
              source: 'Google Maps'
            });
          }
        }
      });

      return trafficObstacles;
    } catch (error) {
      console.error('Error getting traffic info:', error);
      return [];
    }
  }
}

// Create and export singleton instance
const googleMapsService = new GoogleMapsService();
export default googleMapsService;
