import axios from 'axios';
import process from 'process'
window.process=process
const OBSTACLE_SERVICES = {
  WEATHER: {
    baseUrl: 'https://api.openweathermap.org/data/2.5',
    apiKey: process.env.REACT_APP_OPENWEATHER_API_KEY || 'demo_key'
  },
  
  TRAFFIC: {
    baseUrl: 'https://traffic.ls.hereapi.com/traffic/6.3',
    apiKey: process.env.REACT_APP_HERE_API_KEY || 'demo_key'
  },
  
  MAPBOX: {
    baseUrl: 'https://api.mapbox.com/traffic/v1',
    apiKey: process.env.REACT_APP_MAPBOX_API_KEY || 'demo_key'
  },
  TOMTOM: {
    baseUrl: 'https://api.tomtom.com/traffic/services/4',
    apiKey: process.env.REACT_APP_TOMTOM_API_KEY || 'demo_key'
  }
};

class ObstacleDetectionService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; 
    this.requestQueue = [];
    this.isProcessing = false;
  }
  async getRouteObstacles(coordinates, options = {}) {
    try {
      const obstacles = await Promise.allSettled([
        this.getWeatherObstacles(coordinates),
        this.getTrafficObstacles(coordinates),
        this.getConstructionObstacles(coordinates),
        this.getEventObstacles(coordinates)
      ]);

      const allObstacles = obstacles
        .filter(result => result.status === 'fulfilled')
        .flatMap(result => result.value)
        .filter(obstacle => obstacle !== null);

      // Sort by severity and proximity
      return this.prioritizeObstacles(allObstacles, coordinates);
    } catch (error) {
      console.error('Error fetching route obstacles:', error);
      return this.getFallbackObstacles(coordinates);
    }
  }

  async getWeatherObstacles(coordinates) {
    const obstacles = [];
    
    try {
      for (const coord of coordinates.slice(0, 5)) { 
        const cacheKey = `weather_${coord[0]}_${coord[1]}`;
        
        if (this.isCached(cacheKey)) {
          obstacles.push(...this.getFromCache(cacheKey));
          continue;
        }

        const response = await axios.get(`${OBSTACLE_SERVICES.WEATHER.baseUrl}/weather`, {
          params: {
            lat: coord[0],
            lon: coord[1],
            appid: OBSTACLE_SERVICES.WEATHER.apiKey,
            units: 'metric'
          },
          timeout: 5000
        });

        const weatherObstacles = this.parseWeatherData(response.data, coord);
        this.setCache(cacheKey, weatherObstacles);
        obstacles.push(...weatherObstacles);

        // Rate limiting - free tier allows 60 calls/minute
        await this.delay(1100);
      }
    } catch (error) {
      console.warn('Weather API error:', error.message);
      return this.getSimulatedWeatherObstacles(coordinates);
    }

    return obstacles;
  }

  // Traffic obstacles using HERE Traffic API
  async getTrafficObstacles(coordinates) {
    const obstacles = [];
    
    try {
      // Create bounding box from coordinates
      const bounds = this.calculateBounds(coordinates);
      
      const response = await axios.get(`${OBSTACLE_SERVICES.TRAFFIC.baseUrl}/incidents.json`, {
        params: {
          apikey: OBSTACLE_SERVICES.TRAFFIC.apiKey,
          bbox: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
          criticality: 'major,minor',
          type: 'accident,congestion,roadwork,event'
        },
        timeout: 8000
      });

      if (response.data && response.data.TRAFFIC_ITEMS) {
        obstacles.push(...this.parseTrafficData(response.data.TRAFFIC_ITEMS.TRAFFIC_ITEM));
      }
    } catch (error) {
      console.warn('Traffic API error:', error.message);
      return this.getSimulatedTrafficObstacles(coordinates);
    }

    return obstacles;
  }

  // Construction and road work obstacles
  async getConstructionObstacles(coordinates) {
    try {
      // Use TomTom Traffic API for construction data
      const bounds = this.calculateBounds(coordinates);
      
      const response = await axios.get(`${OBSTACLE_SERVICES.TOMTOM.baseUrl}/incidentDetails`, {
        params: {
          key: OBSTACLE_SERVICES.TOMTOM.apiKey,
          bbox: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
          fields: 'incidents{type,geometry,properties{iconCategory,magnitudeOfDelay,events{description,code}}}'
        },
        timeout: 8000
      });

      return this.parseConstructionData(response.data);
    } catch (error) {
      console.warn('Construction API error:', error.message);
      return this.getSimulatedConstructionObstacles(coordinates);
    }
  }

  // Event-based obstacles (concerts, sports, protests)
  async getEventObstacles(coordinates) {
    try {
      // Use multiple free event APIs
      const eventObstacles = await Promise.allSettled([
        this.getTicketmasterEvents(coordinates),
        this.getEventbriteEvents(coordinates),
        this.getPredictHQEvents(coordinates)
      ]);

      return eventObstacles
        .filter(result => result.status === 'fulfilled')
        .flatMap(result => result.value);
    } catch (error) {
      console.warn('Events API error:', error.message);
      return this.getSimulatedEventObstacles(coordinates);
    }
  }

  // Parse weather data into obstacles
  parseWeatherData(data, coord) {
    const obstacles = [];
    const weather = data.weather[0];
    const main = data.main;
    const wind = data.wind;

    // Heavy rain/snow
    if (['Rain', 'Snow', 'Thunderstorm'].includes(weather.main)) {
      obstacles.push({
        id: `weather_${data.id}_${weather.id}`,
        type: weather.main === 'Thunderstorm' ? 'Severe Weather' : weather.main,
        lat: coord[0],
        lng: coord[1],
        severity: this.getWeatherSeverity(weather, main),
        description: `${weather.description} - Visibility and road conditions affected`,
        duration: this.estimateWeatherDuration(weather.main),
        source: 'OpenWeatherMap',
        icon: this.getWeatherIcon(weather.main),
        timestamp: new Date().toISOString(),
        metadata: {
          temperature: main.temp,
          humidity: main.humidity,
          windSpeed: wind?.speed || 0,
          visibility: data.visibility
        }
      });
    }

    // High winds
    if (wind && wind.speed > 10) { // > 36 km/h
      obstacles.push({
        id: `wind_${data.id}`,
        type: 'High Winds',
        lat: coord[0],
        lng: coord[1],
        severity: wind.speed > 15 ? 'High' : 'Medium',
        description: `Strong winds ${Math.round(wind.speed * 3.6)} km/h - Caution for high-profile vehicles`,
        duration: '2-4 hours',
        source: 'OpenWeatherMap',
        icon: '💨',
        timestamp: new Date().toISOString(),
        metadata: {
          windSpeed: wind.speed,
          windDirection: wind.deg
        }
      });
    }

    // Poor visibility
    if (data.visibility && data.visibility < 1000) {
      obstacles.push({
        id: `visibility_${data.id}`,
        type: 'Poor Visibility',
        lat: coord[0],
        lng: coord[1],
        severity: data.visibility < 500 ? 'High' : 'Medium',
        description: `Low visibility ${data.visibility}m - Reduced driving conditions`,
        duration: '1-3 hours',
        source: 'OpenWeatherMap',
        icon: '🌫️',
        timestamp: new Date().toISOString(),
        metadata: {
          visibility: data.visibility
        }
      });
    }

    return obstacles;
  }

  // Parse traffic incident data
  parseTrafficData(trafficItems) {
    if (!Array.isArray(trafficItems)) {
      trafficItems = [trafficItems];
    }

    return trafficItems.map(item => ({
      id: `traffic_${item.TRAFFIC_ITEM_ID}`,
      type: this.mapTrafficType(item.TRAFFIC_ITEM_TYPE_DESC),
      lat: parseFloat(item.LOCATION.GEOLOC.ORIGIN.LATITUDE),
      lng: parseFloat(item.LOCATION.GEOLOC.ORIGIN.LONGITUDE),
      severity: this.mapTrafficSeverity(item.CRITICALITY),
      description: item.TRAFFIC_ITEM_DESCRIPTION[0].content,
      duration: this.estimateTrafficDuration(item),
      source: 'HERE Traffic',
      icon: this.getTrafficIcon(item.TRAFFIC_ITEM_TYPE_DESC),
      timestamp: new Date().toISOString(),
      metadata: {
        roadName: item.LOCATION.DEFINED.ORIGIN.ROADWAY.DESCRIPTION[0].content,
        direction: item.LOCATION.DEFINED.ORIGIN.ROADWAY.DIRECTION,
        length: item.LENGTH
      }
    }));
  }

  // Get Ticketmaster events (free tier: 5000 API calls/day)
  async getTicketmasterEvents(coordinates) {
    try {
      const center = this.calculateCenter(coordinates);
      const response = await axios.get('https://app.ticketmaster.com/discovery/v2/events.json', {
        params: {
          apikey: process.env.REACT_APP_TICKETMASTER_API_KEY || 'demo_key',
          latlong: `${center.lat},${center.lng}`,
          radius: '25',
          unit: 'km',
          size: 10,
          startDateTime: new Date().toISOString(),
          endDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        },
        timeout: 5000
      });

      return this.parseTicketmasterEvents(response.data);
    } catch (error) {
      console.warn('Ticketmaster API error:', error.message);
      return [];
    }
  }

  // Simulate realistic obstacles when APIs are unavailable
  getSimulatedTrafficObstacles(coordinates) {
    const obstacles = [];
    const trafficTypes = [
      { type: 'Heavy Traffic', severity: 'Medium', icon: '🚦', description: 'Congestion reported on main routes' },
      { type: 'Accident', severity: 'High', icon: '🚗💥', description: 'Multi-vehicle collision blocking lanes' },
      { type: 'Road Work', severity: 'Medium', icon: '🚧', description: 'Construction causing lane closures' }
    ];

    coordinates.forEach((coord, index) => {
      if (Math.random() > 0.7) { // 30% chance of obstacle
        const obstacleType = trafficTypes[Math.floor(Math.random() * trafficTypes.length)];
        obstacles.push({
          id: `sim_traffic_${index}_${Date.now()}`,
          type: obstacleType.type,
          lat: coord[0] + (Math.random() - 0.5) * 0.01,
          lng: coord[1] + (Math.random() - 0.5) * 0.01,
          severity: obstacleType.severity,
          description: obstacleType.description,
          duration: '30-60 minutes',
          source: 'Simulated Data',
          icon: obstacleType.icon,
          timestamp: new Date().toISOString(),
          metadata: {
            confidence: 0.8,
            simulated: true
          }
        });
      }
    });

    return obstacles;
  }

  getSimulatedWeatherObstacles(coordinates) {
    const obstacles = [];
    const weatherTypes = [
      { type: 'Rain', severity: 'Medium', icon: '🌧️', description: 'Moderate rainfall affecting visibility' },
      { type: 'Fog', severity: 'High', icon: '🌫️', description: 'Dense fog reducing visibility to 200m' },
      { type: 'High Winds', severity: 'Medium', icon: '💨', description: 'Strong crosswinds affecting vehicle stability' }
    ];

    if (Math.random() > 0.6) { // 40% chance of weather obstacle
      const center = this.calculateCenter(coordinates);
      const weatherType = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
      
      obstacles.push({
        id: `sim_weather_${Date.now()}`,
        type: weatherType.type,
        lat: center.lat + (Math.random() - 0.5) * 0.02,
        lng: center.lng + (Math.random() - 0.5) * 0.02,
        severity: weatherType.severity,
        description: weatherType.description,
        duration: '2-4 hours',
        source: 'Simulated Weather',
        icon: weatherType.icon,
        timestamp: new Date().toISOString(),
        metadata: {
          confidence: 0.7,
          simulated: true
        }
      });
    }

    return obstacles;
  }

  // Utility methods
  calculateBounds(coordinates) {
    const lats = coordinates.map(c => c[0]);
    const lngs = coordinates.map(c => c[1]);
    
    return {
      north: Math.max(...lats) + 0.01,
      south: Math.min(...lats) - 0.01,
      east: Math.max(...lngs) + 0.01,
      west: Math.min(...lngs) - 0.01
    };
  }

  calculateCenter(coordinates) {
    const avgLat = coordinates.reduce((sum, coord) => sum + coord[0], 0) / coordinates.length;
    const avgLng = coordinates.reduce((sum, coord) => sum + coord[1], 0) / coordinates.length;
    return { lat: avgLat, lng: avgLng };
  }

  getWeatherSeverity(weather, main) {
    if (weather.main === 'Thunderstorm') return 'High';
    if (weather.main === 'Snow' && main.temp < -5) return 'High';
    if (weather.main === 'Rain' && weather.id < 520) return 'High'; // Heavy rain
    return 'Medium';
  }

  mapTrafficSeverity(criticality) {
    switch (criticality) {
      case 0: return 'Low';
      case 1: return 'Medium';
      case 2: return 'High';
      default: return 'Medium';
    }
  }

  getWeatherIcon(weatherType) {
    const icons = {
      'Rain': '🌧️',
      'Snow': '❄️',
      'Thunderstorm': '⛈️',
      'Fog': '🌫️',
      'Mist': '🌫️'
    };
    return icons[weatherType] || '🌤️';
  }

  getTrafficIcon(trafficType) {
    const icons = {
      'CONSTRUCTION': '🚧',
      'ACCIDENT': '🚗💥',
      'CONGESTION': '🚦',
      'ROAD_CLOSURE': '🚫',
      'EVENT': '🎪'
    };
    return icons[trafficType] || '⚠️';
  }

  prioritizeObstacles(obstacles, coordinates) {
    return obstacles
      .map(obstacle => ({
        ...obstacle,
        priority: this.calculatePriority(obstacle, coordinates)
      }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 20); // Limit to top 20 obstacles
  }

  calculatePriority(obstacle, coordinates) {
    let priority = 0;
    
    // Severity weight
    const severityWeights = { 'High': 3, 'Medium': 2, 'Low': 1 };
    priority += severityWeights[obstacle.severity] || 1;
    
    // Proximity to route
    const minDistance = Math.min(...coordinates.map(coord => 
      this.calculateDistance(coord[0], coord[1], obstacle.lat, obstacle.lng)
    ));
    priority += Math.max(0, 2 - minDistance); // Higher priority for closer obstacles
    
    // Recency
    const age = Date.now() - new Date(obstacle.timestamp).getTime();
    priority += Math.max(0, 1 - age / (60 * 60 * 1000)); // Fresher data gets higher priority
    
    return priority;
  }

  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Cache management
  isCached(key) {
    const cached = this.cache.get(key);
    return cached && (Date.now() - cached.timestamp) < this.cacheTimeout;
  }

  getFromCache(key) {
    return this.cache.get(key)?.data || [];
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Fallback obstacles for demo purposes
  getFallbackObstacles(coordinates) {
    return [
      ...this.getSimulatedTrafficObstacles(coordinates),
      ...this.getSimulatedWeatherObstacles(coordinates)
    ];
  }
}

export default new ObstacleDetectionService();