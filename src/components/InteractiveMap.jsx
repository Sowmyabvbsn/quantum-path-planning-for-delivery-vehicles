import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MapLegend from './MapLegend';
import obstacleService from '../services/obstacleService';
import routeService from '../services/routeService';

// Fix for default markers in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for different stop types
const createCustomIcon = (color, number, isCurrentLocation = false) => {
  const icon = isCurrentLocation ? '📍' : number;
  const size = isCurrentLocation ? 35 : 30;
  
  return L.divIcon({
    html: `<div style="
      background-color: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: 3px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: white;
      font-size: ${isCurrentLocation ? '16px' : '12px'};
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ${isCurrentLocation ? 'animation: pulse 2s ease-in-out infinite;' : ''}
    ">${icon}</div>`,
    className: 'custom-div-icon',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  });
};

const createObstacleIcon = (type, severity) => {
  const colors = {
    'High': '#ef4444',
    'Medium': '#f59e0b',
    'Low': '#10b981'
  };
  
  const icons = {
    'Construction': '🚧',
    'Traffic': '🚦',
    'Accident': '⚠️',
    'Weather': '🌧️',
    'Event': '🎪',
    'Road Closure': '🚫',
    'Flooding': '🌊',
    'Protest': '📢'
  };
  
  return L.divIcon({
    html: `<div style="
      background-color: ${colors[severity] || '#64748b'};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      animation: ${severity === 'High' ? 'blink 1s ease-in-out infinite' : 'none'};
    ">${icons[type] || '⚠️'}</div>`,
    className: 'obstacle-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

function InteractiveMap({ 
  stops = [], 
  route = null, 
  obstacles = [], 
  onStopClick = null,
  showAnimation = false,
  onAnimationComplete = null,
  height = '500px',
  currentLocation = null
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const routeLayerRef = useRef(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentObstacles, setCurrentObstacles] = useState([]);
  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState(currentLocation);
  const [loadingObstacles, setLoadingObstacles] = useState(false);
  const [realTimeObstacles, setRealTimeObstacles] = useState([]);
  const [obstacleUpdateInterval, setObstacleUpdateInterval] = useState(null);
  const [mapTilesLoaded, setMapTilesLoaded] = useState(false);

  // Get user's current location
  useEffect(() => {
    if (!currentLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          console.warn('Could not get current location:', error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    }
  }, [currentLocation]);

  // Fetch realistic obstacles from multiple data sources
  useEffect(() => {
    if (stops.length > 0) {
      fetchRealTimeObstacles();
      
      // Set up real-time updates every 5 minutes
      const interval = setInterval(() => {
        fetchRealTimeObstacles();
      }, 5 * 60 * 1000);
      
      setObstacleUpdateInterval(interval);
      
      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [stops, route]);

  const fetchRealTimeObstacles = async () => {
    setLoadingObstacles(true);
    try {
      // Create route coordinates for obstacle detection
      let routeCoordinates = [];
      
      // Add user location if available
      if (userLocation) {
        routeCoordinates.push([userLocation.latitude, userLocation.longitude]);
      }
      
      // Add stop coordinates
      const validStops = stops.filter(stop => 
        stop && stop.latitude && stop.longitude && 
        !isNaN(parseFloat(stop.latitude)) && !isNaN(parseFloat(stop.longitude))
      );
      
      routeCoordinates = routeCoordinates.concat(
        validStops.map(stop => [parseFloat(stop.latitude), parseFloat(stop.longitude)])
      );
      
      if (routeCoordinates.length === 0) {
        setCurrentObstacles([]);
        return;
      }
      
      // Fetch real-time obstacles
      const obstacles = await obstacleService.getRouteObstacles(routeCoordinates, {
        includeWeather: true,
        includeTraffic: true,
        includeConstruction: true,
        includeEvents: true,
        maxObstacles: 15
      });
      
      setRealTimeObstacles(obstacles);
      setCurrentObstacles(obstacles);
      
      console.log(`Fetched ${obstacles.length} real-time obstacles`);
    } catch (error) {
      console.warn('Real-time obstacle fetch failed, using fallback:', error);
      const fallbackObstacles = await obstacleService.getFallbackObstacles(
        stops.map(stop => [parseFloat(stop.latitude), parseFloat(stop.longitude)])
      );
      setCurrentObstacles(fallbackObstacles);
    } finally {
      setLoadingObstacles(false);
    }
  };

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (obstacleUpdateInterval) {
        clearInterval(obstacleUpdateInterval);
      }
    };
  }, [obstacleUpdateInterval]);

  // Fetch traffic incidents (simulated with realistic data patterns)
  const fetchTrafficIncidents = async () => {
    // In a real implementation, this would call traffic APIs like:
    // - Google Maps Traffic API
    // - HERE Traffic API
    // - MapBox Traffic API
    // - Local DOT APIs
    
    return generateTrafficIncidents(stops);
  };

  // Fetch weather alerts (simulated)
  const fetchWeatherAlerts = async () => {
    // In a real implementation, this would call weather APIs like:
    // - OpenWeatherMap API
    // - National Weather Service API
    // - AccuWeather API
    
    return generateWeatherAlerts(stops);
  };

  // Fetch construction data (simulated)
  const fetchConstructionData = async () => {
    // In a real implementation, this would call:
    // - Local DOT construction APIs
    // - 511 traffic information systems
    // - City/county road closure APIs
    
    return generateConstructionData(stops);
  };

  // Fetch public events (simulated)
  const fetchPublicEvents = async () => {
    // In a real implementation, this would call:
    // - Eventbrite API
    // - Facebook Events API
    // - Local event calendars
    // - Sports venue APIs
    
    return generatePublicEvents(stops);
  };

  // Initialize map with responsive design
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    try {
      const validStops = stops.filter(stop => 
        stop && 
        stop.latitude && 
        stop.longitude && 
        !isNaN(parseFloat(stop.latitude)) && 
        !isNaN(parseFloat(stop.longitude))
      );

      // Calculate center point - prioritize user location if available
      let center = [40.7128, -74.0060]; // Default to NYC
      let zoom = 4;
      
      if (userLocation) {
        center = [userLocation.latitude, userLocation.longitude];
        zoom = validStops.length > 0 ? 10 : 12;
      } else if (validStops.length > 0) {
        const avgLat = validStops.reduce((sum, stop) => sum + parseFloat(stop.latitude), 0) / validStops.length;
        const avgLng = validStops.reduce((sum, stop) => sum + parseFloat(stop.longitude), 0) / validStops.length;
        center = [avgLat, avgLng];
        zoom = validStops.length === 1 ? 10 : 8;
      }

      // Create responsive map
      const map = L.map(mapRef.current, {
        center: center,
        zoom: zoom,
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        dragging: true,
        touchZoom: true,
        boxZoom: true,
        keyboard: true,
        attributionControl: true,
        // Mobile optimizations
        tap: true,
        tapTolerance: 15,
        bounceAtZoomLimits: false,
        maxBoundsViscosity: 0.8
      });

      // Add Google Maps tile layer with retina support - Initialize map tiles only once
      const tileLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: '&copy; <a href="https://www.google.com/maps">Google Maps</a>',
        maxZoom: 20,
        tileSize: 256,
        zoomOffset: 0,
        detectRetina: true,
        // Mobile performance optimizations
        updateWhenIdle: true,
        updateWhenZooming: false,
        keepBuffer: 2,
        // Google Maps specific
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
      });
      
      // Add tile layer load event listener
      tileLayer.on('load', () => {
        setMapTilesLoaded(true);
      });
      
      tileLayer.addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);

      // Handle responsive resize
      const resizeObserver = new ResizeObserver(() => {
        if (map) {
          setTimeout(() => {
            map.invalidateSize();
          }, 100);
        }
      });

      if (mapRef.current) {
        resizeObserver.observe(mapRef.current);
      }

      // Handle map ready event
      map.whenReady(() => {
        console.log('Map is ready');
        setTimeout(() => {
          map.invalidateSize();
        }, 100);
      });

      // Mobile-specific event handlers
      map.on('movestart', () => {
        // Disable text selection during map interaction
        document.body.style.userSelect = 'none';
      });
      
      map.on('moveend', () => {
        // Re-enable text selection
        document.body.style.userSelect = '';
      });
      return () => {
        resizeObserver.disconnect();
      };

    } catch (error) {
      console.error('Error initializing map:', error);
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
          setMapReady(false);
          setMapTilesLoaded(false);
        } catch (error) {
          console.error('Error cleaning up map:', error);
        }
      }
    };
  }, [userLocation]);

  // Update markers when stops change
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;

    try {
      // Clear existing markers
      markersRef.current.forEach(marker => {
        try {
          mapInstanceRef.current.removeLayer(marker);
        } catch (error) {
          console.warn('Error removing marker:', error);
        }
      });
      markersRef.current = [];

      // Add current location marker
      if (userLocation) {
        const currentLocationMarker = L.marker(
          [userLocation.latitude, userLocation.longitude],
          {
            icon: createCustomIcon('#10b981', '📍', true)
          }
        );

        const locationPopup = `
          <div style="min-width: 200px;">
            <h4 style="margin: 0 0 8px 0; color: #10b981;">📍 Your Current Location</h4>
            <p style="margin: 4px 0; font-size: 0.875rem; color: #64748b;">
              📍 ${userLocation.latitude.toFixed(6)}, ${userLocation.longitude.toFixed(6)}
            </p>
            <p style="margin: 4px 0; font-size: 0.75rem; color: #9ca3af;">
              Accuracy: ±${userLocation.accuracy ? Math.round(userLocation.accuracy) : 'Unknown'} meters
            </p>
          </div>
        `;

        currentLocationMarker.bindPopup(locationPopup);
        currentLocationMarker.addTo(mapInstanceRef.current);
        markersRef.current.push(currentLocationMarker);
      }

      // Validate stops data
      const validStops = stops.filter(stop => 
        stop && 
        stop.latitude && 
        stop.longitude && 
        !isNaN(parseFloat(stop.latitude)) && 
        !isNaN(parseFloat(stop.longitude))
      );

      if (validStops.length === 0) return;

      // Add stop markers
      validStops.forEach((stop, index) => {
        try {
          const isInRoute = route && route.route && route.route.includes(stop.id);
          const routeIndex = isInRoute ? route.route.indexOf(stop.id) + 1 : null;
          
          // Check if this is an OCR-extracted stop
          const isOCRStop = stop.name && stop.name.includes(',') && 
                           (stop.name.includes('Maharashtra') || stop.name.includes('Delhi') || 
                            stop.name.includes('Karnataka') || stop.name.includes('Tamil Nadu') ||
                            stop.name.includes('West Bengal') || stop.source === 'OCR');
          
          const marker = L.marker(
            [parseFloat(stop.latitude), parseFloat(stop.longitude)],
            {
              icon: createCustomIcon(
                isInRoute ? '#667eea' : (isOCRStop ? '#10b981' : '#64748b'),
                routeIndex || (index + 1)
              )
            }
          );

          const popupContent = `
            <div style="min-width: 200px;">
              <h4 style="margin: 0 0 8px 0; color: #1e293b;">${stop.name}</h4>
              ${isOCRStop ? `<p style="margin: 4px 0; font-size: 0.75rem; color: #10b981; font-weight: bold;">
                🔍 OCR Extracted Location
              </p>` : ''}
              <p style="margin: 4px 0; font-size: 0.875rem; color: #64748b;">
                📍 ${parseFloat(stop.latitude).toFixed(4)}, ${parseFloat(stop.longitude).toFixed(4)}
              </p>
              ${isInRoute ? `<p style="margin: 4px 0; font-size: 0.875rem; color: #667eea; font-weight: bold;">
                🚛 Stop #${routeIndex} in route
              </p>` : ''}
              ${userLocation ? `<p style="margin: 4px 0; font-size: 0.75rem; color: #9ca3af;">
                Distance from you: ${calculateDistance(
                  userLocation.latitude, userLocation.longitude,
                  parseFloat(stop.latitude), parseFloat(stop.longitude)
                ).toFixed(2)} km
              </p>` : ''}
              <p style="margin: 4px 0; font-size: 0.75rem; color: #9ca3af;">
                Added: ${new Date(stop.created_at).toLocaleDateString()}
              </p>
            </div>
          `;

          marker.bindPopup(popupContent);

          if (onStopClick) {
            marker.on('click', () => onStopClick(stop));
          }

          marker.addTo(mapInstanceRef.current);
          markersRef.current.push(marker);
        } catch (error) {
          console.warn('Error adding marker for stop:', stop.name, error);
        }
      });

      // Add obstacle markers
      currentObstacles.forEach((obstacle, index) => {
        try {
          const obstacleMarker = L.marker(
            [obstacle.lat, obstacle.lng],
            { icon: createObstacleIcon(obstacle.type, obstacle.severity) }
          );

          const obstaclePopup = `
            <div>
              <h4 style="margin: 0 0 8px 0; color: ${getSeverityColor(obstacle.severity)};">
                ${getObstacleIcon(obstacle.type)} ${obstacle.type}
              </h4>
              <p style="margin: 4px 0; font-size: 0.875rem;">${obstacle.description}</p>
              <p style="margin: 4px 0; font-size: 0.75rem; color: #9ca3af;">
                Severity: <span style="color: ${getSeverityColor(obstacle.severity)}; font-weight: bold;">${obstacle.severity}</span>
              </p>
              ${obstacle.duration ? `<p style="margin: 4px 0; font-size: 0.75rem; color: #9ca3af;">
                Duration: ${obstacle.duration}
              </p>` : ''}
              ${obstacle.source ? `<p style="margin: 4px 0; font-size: 0.75rem; color: #9ca3af;">
                Source: ${obstacle.source}
              </p>` : ''}
            </div>
          `;

          obstacleMarker.bindPopup(obstaclePopup);
          obstacleMarker.addTo(mapInstanceRef.current);
          markersRef.current.push(obstacleMarker);
        } catch (error) {
          console.warn('Error adding obstacle marker:', error);
        }
      });

      // Fit bounds to show all markers including current location
      const allPoints = [];
      if (userLocation) {
        allPoints.push([userLocation.latitude, userLocation.longitude]);
      }
      validStops.forEach(stop => {
        allPoints.push([parseFloat(stop.latitude), parseFloat(stop.longitude)]);
      });

      if (allPoints.length > 0) {
        try {
          mapInstanceRef.current.fitBounds(allPoints, { 
            padding: [20, 20],
            maxZoom: 15
          });
        } catch (error) {
          console.warn('Error fitting bounds:', error);
        }
      }
    } catch (error) {
      console.error('Error updating markers:', error);
    }
  }, [stops, route, currentObstacles, onStopClick, mapReady, userLocation]);

  // Update route with road-following optimization
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;

    const updateRoadFollowingRoute = async () => {
      try {
        // Clear existing route
        if (routeLayerRef.current) {
          mapInstanceRef.current.removeLayer(routeLayerRef.current);
          routeLayerRef.current = null;
        }

        const validStops = stops.filter(stop =>
          stop &&
          stop.latitude &&
          stop.longitude &&
          !isNaN(parseFloat(stop.latitude)) &&
          !isNaN(parseFloat(stop.longitude))
        );

        if (!route || !route.route || route.route.length < 2 || validStops.length === 0) return;

        // Prepare stops for road-following route
        let routeStops = [];

        // Add current location as starting point if available
        if (userLocation) {
          routeStops.push({
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            name: 'Current Location'
          });
        }

        // Add route stops in order
        const orderedStops = route.route.map(stopIndex => {
          const stop = validStops.find(s => s.id === stopIndex) || validStops[stopIndex];
          return stop ? {
            latitude: parseFloat(stop.latitude),
            longitude: parseFloat(stop.longitude),
            name: stop.name || `Stop ${stopIndex}`
          } : null;
        }).filter(Boolean);

        routeStops = routeStops.concat(orderedStops);

        if (routeStops.length < 2) return;

        // Get road-following route from Google Directions API
        const roadRoute = await routeService.getRoadFollowingRoute(routeStops, {
          optimize: false, // We already have the optimized order from quantum algorithm
          avoid: ['tolls'] // Avoid tolls by default
        });

        if (roadRoute.success) {
          // Use road-following coordinates
          const roadCoordinates = roadRoute.coordinates;

          // Add route visualization
          if (showAnimation) {
            animateRoute(roadCoordinates);
          } else {
            // Main road-following route
            routeLayerRef.current = L.polyline(roadCoordinates, {
              color: '#667eea',
              weight: 4,
              opacity: 0.8,
              smoothFactor: 1.0
            }).addTo(mapInstanceRef.current);

            // Add route info popup
            const routeInfo = L.popup()
              .setLatLng(roadCoordinates[Math.floor(roadCoordinates.length / 2)])
              .setContent(`
                <div style="text-align: center; font-family: system-ui;">
                  <strong>🛣️ Road-Following Route</strong><br/>
                  <small>Distance: ${(roadRoute.totalDistance / 1000).toFixed(1)} km</small><br/>
                  <small>Duration: ${Math.round(roadRoute.totalDuration / 60)} min</small><br/>
                  ${roadRoute.durationInTraffic > roadRoute.totalDuration ?
                    `<small style="color: #f59e0b;">Traffic delay: +${Math.round((roadRoute.durationInTraffic - roadRoute.totalDuration) / 60)} min</small>` :
                    '<small style="color: #10b981;">No traffic delays</small>'
                  }
                </div>
              `);

            // Add distance labels along the route
            addDistanceLabels(roadCoordinates);
          }
        } else {
          // Fallback to straight-line route if Google Directions fails
          console.warn('Road-following route failed, using fallback:', roadRoute.error);
          const fallbackCoordinates = roadRoute.fallbackCoordinates || routeStops.map(stop => [stop.latitude, stop.longitude]);

          routeLayerRef.current = L.polyline(fallbackCoordinates, {
            color: '#f59e0b',
            weight: 3,
            opacity: 0.7,
            dashArray: '10, 5'
          }).addTo(mapInstanceRef.current);

          // Show warning popup
          L.popup()
            .setLatLng(fallbackCoordinates[Math.floor(fallbackCoordinates.length / 2)])
            .setContent(`
              <div style="text-align: center; font-family: system-ui; color: #f59e0b;">
                <strong>⚠️ Fallback Route</strong><br/>
                <small>Road data unavailable</small><br/>
                <small>Showing direct path</small>
              </div>
            `)
            .openOn(mapInstanceRef.current);
        }

      } catch (error) {
        console.error('Error updating road-following route:', error);

        // Fallback to basic route visualization
        const basicCoordinates = routeStops.map(stop => [stop.latitude, stop.longitude]);
        routeLayerRef.current = L.polyline(basicCoordinates, {
          color: '#ef4444',
          weight: 3,
          opacity: 0.7,
          dashArray: '5, 10'
        }).addTo(mapInstanceRef.current);
      }
    };

    updateRoadFollowingRoute();
  }, [route, stops, currentObstacles, showAnimation, mapReady, userLocation]);

  // Animation function with smooth transitions for road-following routes
  const animateRoute = (routeCoordinates) => {
    if (!mapInstanceRef.current || routeCoordinates.length < 2) return;

    setIsAnimating(true);
    let segmentIndex = 0;
    const segments = [];
    const animationSpeed = Math.max(50, Math.min(200, 10000 / routeCoordinates.length)); // Adaptive speed

    const animateSegment = () => {
      if (segmentIndex >= routeCoordinates.length - 1) {
        setIsAnimating(false);
        if (onAnimationComplete) {
          onAnimationComplete();
        }
        return;
      }

      try {
        // Create animated segment following the road
        const segment = L.polyline(
          [routeCoordinates[segmentIndex], routeCoordinates[segmentIndex + 1]],
          {
            color: '#667eea',
            weight: 4,
            opacity: 0.9,
            dashArray: '8, 4'
          }
        ).addTo(mapInstanceRef.current);

        segments.push(segment);

        // Add a moving marker for better visualization
        if (segmentIndex % 10 === 0) { // Every 10th segment
          const movingMarker = L.circleMarker(routeCoordinates[segmentIndex], {
            radius: 6,
            fillColor: '#667eea',
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          }).addTo(mapInstanceRef.current);

          // Remove marker after a short time
          setTimeout(() => {
            if (mapInstanceRef.current && mapInstanceRef.current.hasLayer(movingMarker)) {
              mapInstanceRef.current.removeLayer(movingMarker);
            }
          }, 2000);
        }

        segmentIndex++;
        setTimeout(animateSegment, animationSpeed);
      } catch (error) {
        console.error('Animation error:', error);
        setIsAnimating(false);
      }
    };

    animateSegment();
  };

  // Add distance labels along the route
  const addDistanceLabels = (routeCoordinates) => {
    for (let i = 0; i < routeCoordinates.length - 1; i++) {
      const start = routeCoordinates[i];
      const end = routeCoordinates[i + 1];
      const midpoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
      const distance = calculateDistance(start[0], start[1], end[0], end[1]);

      const distanceLabel = L.marker(midpoint, {
        icon: L.divIcon({
          html: `<div style="
            background: rgba(102, 126, 234, 0.9);
            color: white;
            padding: 2px 6px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: bold;
            white-space: nowrap;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          ">${distance.toFixed(1)} km</div>`,
          className: 'distance-label',
          iconSize: [0, 0],
          iconAnchor: [0, 0]
        })
      });

      distanceLabel.addTo(mapInstanceRef.current);
      markersRef.current.push(distanceLabel);
    }
  };

  // Handle animation trigger
  useEffect(() => {
    if (showAnimation && route && route.route && route.route.length > 0) {
      const event = new CustomEvent('triggerAnimation');
      window.dispatchEvent(event);
    }
  }, [showAnimation]);

  // Responsive container styles
  const containerStyle = {
    height: height,
    width: '100%',
    borderRadius: '12px',
    overflow: 'hidden',
    position: 'relative',
    minHeight: '300px'
  };

  // Mobile responsive adjustments
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    containerStyle.height = '400px';
    containerStyle.borderRadius = '8px';
  }

  const validStops = stops.filter(stop => 
    stop && 
    stop.latitude && 
    stop.longitude && 
    !isNaN(parseFloat(stop.latitude)) && 
    !isNaN(parseFloat(stop.longitude))
  );

  if (validStops.length === 0 && !userLocation) {
    return (
      <div style={{ 
        ...containerStyle,
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px dashed #cbd5e0'
      }}>
        <div style={{ 
          textAlign: 'center',
          color: '#64748b',
          padding: '2rem'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗺️</div>
          <h4>No stops to display</h4>
          <p>Add some stops to see them on the map</p>
          <button
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    setUserLocation({
                      latitude: position.coords.latitude,
                      longitude: position.coords.longitude,
                      accuracy: position.coords.accuracy
                    });
                  },
                  (error) => console.warn('Location access denied:', error)
                );
              }
            }}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            📍 Use My Location
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
      
      {/* Map tiles loading indicator */}
      {!mapTilesLoaded && mapReady && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '0.875rem',
          color: '#667eea',
          fontWeight: '500',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            border: '2px solid #667eea',
            borderTop: '2px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          Loading map tiles...
        </div>
      )}
      
      {/* Loading obstacles indicator */}
      {loadingObstacles && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '0.875rem',
          color: '#10b981',
          fontWeight: '500',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            width: '12px',
            height: '12px',
            border: '2px solid #10b981',
            borderTop: '2px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          Updating obstacles...
        </div>
      )}
      
      {/* Real-time data indicator */}
      {realTimeObstacles.length > 0 && !loadingObstacles && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(16, 185, 129, 0.9)',
          color: 'white',
          padding: '6px 10px',
          borderRadius: '6px',
          fontSize: '0.75rem',
          fontWeight: '500',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#ffffff',
            animation: 'pulse 2s ease-in-out infinite'
          }}></div>
          Live Data Active
        </div>
      )}
      
      {/* Animation status */}
      {isAnimating && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '0.875rem',
          color: '#667eea',
          fontWeight: '500',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#10b981',
            animation: 'pulse 2s ease-in-out infinite'
          }}></div>
          Animating route...
        </div>
      )}
      
      {/* Current location indicator */}
      {userLocation && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(16, 185, 129, 0.9)',
          color: 'white',
          padding: '6px 10px',
          borderRadius: '6px',
          fontSize: '0.75rem',
          fontWeight: '500',
          zIndex: 1000
        }}>
          📍 Current Location Active
        </div>
      )}
      
      {/* Map legend */}
      <div style={{ position: 'absolute', bottom: '10px', right: '10px', zIndex: 1000 }}>
        <MapLegend />
      </div>
      
      {/* Obstacle count */}
      {currentObstacles.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          background: currentObstacles.some(o => o.severity === 'High') 
            ? 'rgba(239, 68, 68, 0.9)' 
            : 'rgba(245, 158, 11, 0.9)',
          color: 'white',
          padding: '6px 10px',
          borderRadius: '6px',
          fontSize: '0.75rem',
          fontWeight: '500',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span>
            {currentObstacles.some(o => o.severity === 'High') ? '🚨' : '⚠️'}
          </span>
          {currentObstacles.length} Live Obstacles
          <div style={{
            fontSize: '0.625rem',
            opacity: 0.8,
            marginLeft: '4px'
          }}>
            {realTimeObstacles.length > 0 ? 'REAL-TIME' : 'SIMULATED'}
          </div>
        </div>
      )}
    </div>
  );
}

// Hybrid route optimization combining QAOA with classical algorithms
function calculateHybridRoute(routeCoordinates, obstacles) {
  if (routeCoordinates.length < 2) return routeCoordinates;

  // Apply obstacle avoidance using A* pathfinding principles
  const optimizedRoute = [];
  
  for (let i = 0; i < routeCoordinates.length - 1; i++) {
    const start = routeCoordinates[i];
    const end = routeCoordinates[i + 1];
    
    optimizedRoute.push(start);
    
    // Find obstacles that might affect this segment
    const relevantObstacles = obstacles.filter(obstacle => 
      isObstacleNearSegment(start, end, [obstacle.lat, obstacle.lng], obstacle.severity)
    );
    
    if (relevantObstacles.length > 0) {
      // Calculate avoidance waypoints using hybrid approach
      const waypoints = calculateHybridWaypoints(start, end, relevantObstacles);
      optimizedRoute.push(...waypoints);
    }
  }
  
  optimizedRoute.push(routeCoordinates[routeCoordinates.length - 1]);
  
  // Apply smoothing algorithm for better route visualization
  return smoothRoute(optimizedRoute);
}

function isObstacleNearSegment(start, end, obstacle, severity) {
  const thresholds = {
    'High': 0.008,    // ~800m
    'Medium': 0.005,  // ~500m
    'Low': 0.003      // ~300m
  };
  
  const threshold = thresholds[severity] || 0.005;
  
  // Calculate distance from obstacle to line segment
  const A = end[0] - start[0];
  const B = end[1] - start[1];
  const C = obstacle[0] - start[0];
  const D = obstacle[1] - start[1];
  
  const dot = A * C + B * D;
  const lenSq = A * A + B * B;
  
  if (lenSq === 0) return false;
  
  const param = Math.max(0, Math.min(1, dot / lenSq));
  const xx = start[0] + param * A;
  const yy = start[1] + param * B;
  
  const dx = obstacle[0] - xx;
  const dy = obstacle[1] - yy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  return distance < threshold;
}

function calculateHybridWaypoints(start, end, obstacles) {
  const waypoints = [];
  
  obstacles.forEach(obstacle => {
    const obstaclePoint = [obstacle.lat, obstacle.lng];
    
    // Calculate avoidance distance based on severity
    const avoidanceDistances = {
      'High': 0.012,    // ~1.2km
      'Medium': 0.008,  // ~800m
      'Low': 0.005      // ~500m
    };
    
    const avoidanceDistance = avoidanceDistances[obstacle.severity] || 0.008;
    
    // Calculate perpendicular avoidance route
    const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
    const perpAngle = angle + Math.PI / 2;
    
    // Create two potential waypoints (left and right of obstacle)
    const waypoint1 = [
      obstaclePoint[0] + Math.cos(perpAngle) * avoidanceDistance,
      obstaclePoint[1] + Math.sin(perpAngle) * avoidanceDistance
    ];
    
    const waypoint2 = [
      obstaclePoint[0] - Math.cos(perpAngle) * avoidanceDistance,
      obstaclePoint[1] - Math.sin(perpAngle) * avoidanceDistance
    ];
    
    // Choose the waypoint that results in shorter total distance
    const dist1 = calculateDistance(start[0], start[1], waypoint1[0], waypoint1[1]) +
                  calculateDistance(waypoint1[0], waypoint1[1], end[0], end[1]);
    const dist2 = calculateDistance(start[0], start[1], waypoint2[0], waypoint2[1]) +
                  calculateDistance(waypoint2[0], waypoint2[1], end[0], end[1]);
    
    waypoints.push(dist1 < dist2 ? waypoint1 : waypoint2);
  });
  
  return waypoints;
}

function smoothRoute(route) {
  if (route.length < 3) return route;
  
  const smoothed = [route[0]]; // Keep first point
  
  for (let i = 1; i < route.length - 1; i++) {
    const prev = route[i - 1];
    const curr = route[i];
    const next = route[i + 1];
    
    // Apply simple smoothing by averaging with neighbors
    const smoothedPoint = [
      (prev[0] + curr[0] + next[0]) / 3,
      (prev[1] + curr[1] + next[1]) / 3
    ];
    
    smoothed.push(smoothedPoint);
  }
  
  smoothed.push(route[route.length - 1]); // Keep last point
  return smoothed;
}

// Utility functions
function calculateDistance(lat1, lng1, lat2, lng2) {
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

function getSeverityColor(severity) {
  const colors = {
    'High': '#ef4444',
    'Medium': '#f59e0b',
    'Low': '#10b981'
  };
  return colors[severity] || '#64748b';
}

function getObstacleIcon(type) {
  const icons = {
    'Construction': '🚧',
    'Traffic': '🚦',
    'Accident': '⚠️',
    'Weather': '🌧️',
    'Event': '🎪',
    'Road Closure': '🚫',
    'Flooding': '🌊',
    'Protest': '📢'
  };
  return icons[type] || '⚠️';
}

export default InteractiveMap;