import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MapLegend from './MapLegend';

// Fix for default markers in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for different stop types
const createCustomIcon = (color, number) => {
  return L.divIcon({
    html: `<div style="
      background-color: ${color};
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: 3px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: white;
      font-size: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">${number}</div>`,
    className: 'custom-div-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

const obstacleIcon = L.divIcon({
  html: `<div style="
    background-color: #ef4444;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    color: white;
    font-size: 10px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  ">⚠️</div>`,
  className: 'obstacle-icon',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function InteractiveMap({ 
  stops = [], 
  route = null, 
  obstacles = [], 
  onStopClick = null,
  showAnimation = false,
  onAnimationComplete = null,
  height = '500px'
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const routeLayerRef = useRef(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentObstacles, setCurrentObstacles] = useState(obstacles);
  const [mapReady, setMapReady] = useState(false);

  // Generate some sample obstacles for demonstration
  useEffect(() => {
    if (stops.length > 0 && obstacles.length === 0) {
      const sampleObstacles = generateSampleObstacles(stops);
      setCurrentObstacles(sampleObstacles);
    }
  }, [stops, obstacles]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    try {
      // Validate stops data
      const validStops = stops.filter(stop => 
        stop && 
        stop.latitude && 
        stop.longitude && 
        !isNaN(parseFloat(stop.latitude)) && 
        !isNaN(parseFloat(stop.longitude))
      );

      // Calculate center point
      let center = [40.7128, -74.0060]; // Default to NYC
      let zoom = 4;
      
      if (validStops.length > 0) {
        const avgLat = validStops.reduce((sum, stop) => sum + parseFloat(stop.latitude), 0) / validStops.length;
        const avgLng = validStops.reduce((sum, stop) => sum + parseFloat(stop.longitude), 0) / validStops.length;
        center = [avgLat, avgLng];
        zoom = validStops.length === 1 ? 10 : 8;
      }

      // Create map
      const map = L.map(mapRef.current, {
        center: center,
        zoom: zoom,
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        dragging: true
      });

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);

      // Handle map ready event
      map.whenReady(() => {
        console.log('Map is ready');
        setTimeout(() => {
          map.invalidateSize();
        }, 100);
      });

    } catch (error) {
      console.error('Error initializing map:', error);
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
          setMapReady(false);
        } catch (error) {
          console.error('Error cleaning up map:', error);
        }
      }
    };
  }, []);

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

      // Validate stops data
      const validStops = stops.filter(stop => 
        stop && 
        stop.latitude && 
        stop.longitude && 
        !isNaN(parseFloat(stop.latitude)) && 
        !isNaN(parseFloat(stop.longitude))
      );

      if (validStops.length === 0) return;

      // Add new markers
      validStops.forEach((stop, index) => {
        try {
          const isInRoute = route && route.route && route.route.includes(stop.id);
          const routeIndex = isInRoute ? route.route.indexOf(stop.id) + 1 : null;
          
          const marker = L.marker(
            [parseFloat(stop.latitude), parseFloat(stop.longitude)],
            {
              icon: createCustomIcon(
                isInRoute ? '#667eea' : '#64748b',
                routeIndex || (index + 1)
              )
            }
          );

          // Add popup
          const popupContent = `
            <div style="min-width: 200px;">
              <h4 style="margin: 0 0 8px 0; color: #1e293b;">${stop.name}</h4>
              <p style="margin: 4px 0; font-size: 0.875rem; color: #64748b;">
                📍 ${parseFloat(stop.latitude).toFixed(4)}, ${parseFloat(stop.longitude).toFixed(4)}
              </p>
              ${isInRoute ? `<p style="margin: 4px 0; font-size: 0.875rem; color: #667eea; font-weight: bold;">
                🚛 Stop #${routeIndex} in route
              </p>` : ''}
              <p style="margin: 4px 0; font-size: 0.75rem; color: #9ca3af;">
                Added: ${new Date(stop.created_at).toLocaleDateString()}
              </p>
            </div>
          `;

          marker.bindPopup(popupContent);

          // Add click handler
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
            { icon: obstacleIcon }
          );

          const obstaclePopup = `
            <div>
              <h4 style="margin: 0 0 8px 0; color: #ef4444;">⚠️ ${obstacle.type}</h4>
              <p style="margin: 4px 0; font-size: 0.875rem;">${obstacle.description}</p>
              <p style="margin: 4px 0; font-size: 0.75rem; color: #9ca3af;">
                Severity: ${obstacle.severity}
              </p>
            </div>
          `;

          obstacleMarker.bindPopup(obstaclePopup);
          obstacleMarker.addTo(mapInstanceRef.current);
          markersRef.current.push(obstacleMarker);
        } catch (error) {
          console.warn('Error adding obstacle marker:', error);
        }
      });

      // Fit bounds to show all markers
      if (validStops.length > 0) {
        try {
          const bounds = validStops.map(stop => [parseFloat(stop.latitude), parseFloat(stop.longitude)]);
          mapInstanceRef.current.fitBounds(bounds, { padding: [20, 20] });
        } catch (error) {
          console.warn('Error fitting bounds:', error);
        }
      }
    } catch (error) {
      console.error('Error updating markers:', error);
    }
  }, [stops, route, currentObstacles, onStopClick, mapReady]);

  // Update route when route changes
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;

    try {
      // Clear existing route
      if (routeLayerRef.current) {
        mapInstanceRef.current.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }

      // Validate stops data
      const validStops = stops.filter(stop => 
        stop && 
        stop.latitude && 
        stop.longitude && 
        !isNaN(parseFloat(stop.latitude)) && 
        !isNaN(parseFloat(stop.longitude))
      );

      if (!route || !route.route || route.route.length < 2 || validStops.length === 0) return;

      // Convert route indices to coordinates
      const routeCoordinates = route.route.map(stopIndex => {
        const stop = validStops.find(s => s.id === stopIndex) || validStops[stopIndex];
        return stop ? [parseFloat(stop.latitude), parseFloat(stop.longitude)] : null;
      }).filter(Boolean);

      if (routeCoordinates.length < 2) return;

      // Calculate route with obstacle avoidance
      const optimizedRoute = calculateRouteWithObstacles(routeCoordinates, currentObstacles);

      // Add route polyline
      if (showAnimation) {
        animateRoute(optimizedRoute);
      } else {
        routeLayerRef.current = L.polyline(optimizedRoute, {
          color: '#667eea',
          weight: 4,
          opacity: 0.8
        }).addTo(mapInstanceRef.current);

        // Add direct route for comparison
        L.polyline(routeCoordinates, {
          color: '#e2e8f0',
          weight: 2,
          opacity: 0.5,
          dashArray: '5, 10'
        }).addTo(mapInstanceRef.current);
      }
    } catch (error) {
      console.error('Error updating route:', error);
    }
  }, [route, stops, currentObstacles, showAnimation, mapReady]);

  // Animation function
  const animateRoute = (routeCoordinates) => {
    if (!mapInstanceRef.current || routeCoordinates.length < 2) return;

    setIsAnimating(true);
    let segmentIndex = 0;
    const segments = [];

    const animateSegment = () => {
      if (segmentIndex >= routeCoordinates.length - 1) {
        setIsAnimating(false);
        if (onAnimationComplete) {
          onAnimationComplete();
        }
        return;
      }

      try {
        const segment = L.polyline(
          [routeCoordinates[segmentIndex], routeCoordinates[segmentIndex + 1]],
          {
            color: '#667eea',
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 5'
          }
        ).addTo(mapInstanceRef.current);

        segments.push(segment);
        segmentIndex++;

        setTimeout(animateSegment, 800);
      } catch (error) {
        console.warn('Error in animation segment:', error);
        setIsAnimating(false);
      }
    };

    animateSegment();
  };

  // Handle animation trigger
  useEffect(() => {
    if (showAnimation && route && route.route && route.route.length > 0) {
      // Re-trigger route update with animation
      const event = new CustomEvent('triggerAnimation');
      window.dispatchEvent(event);
    }
  }, [showAnimation]);

  // If no valid stops, show a simple placeholder
  const validStops = stops.filter(stop => 
    stop && 
    stop.latitude && 
    stop.longitude && 
    !isNaN(parseFloat(stop.latitude)) && 
    !isNaN(parseFloat(stop.longitude))
  );

  if (validStops.length === 0) {
    return (
      <div style={{ 
        height: height, 
        width: '100%', 
        borderRadius: '12px', 
        overflow: 'hidden',
        position: 'relative',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px dashed #cbd5e0'
      }}>
        <div style={{ 
          textAlign: 'center',
          color: '#64748b'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗺️</div>
          <h4>No stops to display</h4>
          <p>Add some stops to see them on the map</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: height, width: '100%', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
      
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
      
      {/* Map legend */}
      <div style={{ position: 'absolute', bottom: '10px', right: '10px', zIndex: 1000 }}>
        <MapLegend />
      </div>
    </div>
  );
}

// Helper function to generate sample obstacles
function generateSampleObstacles(stops) {
  if (stops.length < 2) return [];
  
  const obstacles = [];
  const obstacleTypes = [
    { type: 'Construction', description: 'Road construction work', severity: 'High' },
    { type: 'Traffic Jam', description: 'Heavy traffic congestion', severity: 'Medium' },
    { type: 'Accident', description: 'Vehicle accident blocking road', severity: 'High' },
    { type: 'Weather', description: 'Flooding or severe weather', severity: 'Medium' },
    { type: 'Event', description: 'Public event causing delays', severity: 'Low' }
  ];
  
  // Generate obstacles between stops
  for (let i = 0; i < Math.min(stops.length - 1, 3); i++) {
    const stop1 = stops[i];
    const stop2 = stops[i + 1];
    
    if (!stop1 || !stop2 || !stop1.latitude || !stop1.longitude || !stop2.latitude || !stop2.longitude) {
      continue;
    }
    
    // Create obstacle roughly between two stops
    const midLat = (parseFloat(stop1.latitude) + parseFloat(stop2.latitude)) / 2;
    const midLng = (parseFloat(stop1.longitude) + parseFloat(stop2.longitude)) / 2;
    
    // Add some randomness
    const offsetLat = (Math.random() - 0.5) * 0.01;
    const offsetLng = (Math.random() - 0.5) * 0.01;
    
    const obstacleType = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    
    obstacles.push({
      lat: midLat + offsetLat,
      lng: midLng + offsetLng,
      ...obstacleType
    });
  }
  
  return obstacles;
}

// Helper function to calculate route avoiding obstacles
function calculateRouteWithObstacles(routeCoordinates, obstacles) {
  if (routeCoordinates.length < 2 || obstacles.length === 0) {
    return routeCoordinates;
  }
  
  const optimizedRoute = [];
  
  for (let i = 0; i < routeCoordinates.length - 1; i++) {
    const start = routeCoordinates[i];
    const end = routeCoordinates[i + 1];
    
    optimizedRoute.push(start);
    
    // Check if there are obstacles between start and end
    const segmentObstacles = obstacles.filter(obstacle => 
      isObstacleBetweenPoints(start, end, [obstacle.lat, obstacle.lng])
    );
    
    if (segmentObstacles.length > 0) {
      // Add waypoints to avoid obstacles
      const waypoints = calculateAvoidanceWaypoints(start, end, segmentObstacles);
      optimizedRoute.push(...waypoints);
    }
  }
  
  // Add the final destination
  optimizedRoute.push(routeCoordinates[routeCoordinates.length - 1]);
  
  return optimizedRoute;
}

// Helper function to check if obstacle is between two points
function isObstacleBetweenPoints(start, end, obstacle) {
  const threshold = 0.005; // Roughly 500 meters
  
  // Calculate distance from obstacle to line segment
  const A = end[0] - start[0];
  const B = end[1] - start[1];
  const C = obstacle[0] - start[0];
  const D = obstacle[1] - start[1];
  
  const dot = A * C + B * D;
  const lenSq = A * A + B * B;
  
  if (lenSq === 0) return false;
  
  const param = dot / lenSq;
  
  let xx, yy;
  if (param < 0) {
    xx = start[0];
    yy = start[1];
  } else if (param > 1) {
    xx = end[0];
    yy = end[1];
  } else {
    xx = start[0] + param * A;
    yy = start[1] + param * B;
  }
  
  const dx = obstacle[0] - xx;
  const dy = obstacle[1] - yy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  return distance < threshold;
}

// Helper function to calculate waypoints to avoid obstacles
function calculateAvoidanceWaypoints(start, end, obstacles) {
  const waypoints = [];
  
  obstacles.forEach(obstacle => {
    const obstaclePoint = [obstacle.lat, obstacle.lng];
    
    // Calculate perpendicular offset to avoid obstacle
    const offsetDistance = 0.008; // Roughly 800 meters
    const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
    const perpAngle = angle + Math.PI / 2;
    
    const waypointLat = obstaclePoint[0] + Math.cos(perpAngle) * offsetDistance;
    const waypointLng = obstaclePoint[1] + Math.sin(perpAngle) * offsetDistance;
    
    waypoints.push([waypointLat, waypointLng]);
  });
  
  return waypoints;
}

export default InteractiveMap;