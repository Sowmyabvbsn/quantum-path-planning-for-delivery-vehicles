import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MapLegend from './MapLegend';

// Fix for default markers in react-leaflet
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

// Component to fit map bounds to show all markers
function MapBounds({ bounds }) {
  const map = useMap();
  
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      const leafletBounds = L.latLngBounds(bounds);
      map.fitBounds(leafletBounds, { padding: [20, 20] });
    }
  }, [bounds, map]);
  
  return null;
}

// Component for animated route drawing
function AnimatedRoute({ route, isAnimating, onAnimationComplete }) {
  const [visibleSegments, setVisibleSegments] = useState(0);
  const map = useMap();
  
  useEffect(() => {
    if (!isAnimating || !route || route.length < 2) {
      setVisibleSegments(route ? route.length - 1 : 0);
      return;
    }
    
    setVisibleSegments(0);
    const totalSegments = route.length - 1;
    let currentSegment = 0;
    
    const animationInterval = setInterval(() => {
      currentSegment++;
      setVisibleSegments(currentSegment);
      
      if (currentSegment >= totalSegments) {
        clearInterval(animationInterval);
        if (onAnimationComplete) {
          onAnimationComplete();
        }
      }
    }, 800);
    
    return () => clearInterval(animationInterval);
  }, [isAnimating, route, onAnimationComplete]);
  
  if (!route || route.length < 2) return null;
  
  const segments = [];
  for (let i = 0; i < Math.min(visibleSegments, route.length - 1); i++) {
    segments.push(
      <Polyline
        key={`segment-${i}`}
        positions={[route[i], route[i + 1]]}
        color="#667eea"
        weight={4}
        opacity={0.8}
        dashArray="10, 5"
      />
    );
  }
  
  return <>{segments}</>;
}

function InteractiveMap({ 
  stops = [], 
  route = null, 
  obstacles = [], 
  onStopClick = null,
  showAnimation = false,
  onAnimationComplete = null 
}) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentObstacles, setCurrentObstacles] = useState(obstacles);
  const mapRef = useRef();

  // Generate some sample obstacles for demonstration
  useEffect(() => {
    if (stops.length > 0 && obstacles.length === 0) {
      const sampleObstacles = generateSampleObstacles(stops);
      setCurrentObstacles(sampleObstacles);
    }
  }, [stops, obstacles]);

  // Start animation when route changes
  useEffect(() => {
    if (showAnimation && route && route.length > 0) {
      setIsAnimating(true);
    }
  }, [route, showAnimation]);

  const handleAnimationComplete = () => {
    setIsAnimating(false);
    if (onAnimationComplete) {
      onAnimationComplete();
    }
  };

  // Calculate map bounds
  const bounds = stops.length > 0 
    ? stops.map(stop => [parseFloat(stop.latitude), parseFloat(stop.longitude)])
    : [[40.7128, -74.0060], [40.7589, -73.9851]]; // Default to NYC area

  // Convert route indices to coordinates
  const routeCoordinates = route && route.route 
    ? route.route.map(stopIndex => {
        const stop = stops.find(s => s.id === stopIndex) || stops[stopIndex];
        return stop ? [parseFloat(stop.latitude), parseFloat(stop.longitude)] : null;
      }).filter(Boolean)
    : [];

  // Calculate route with obstacle avoidance
  const optimizedRoute = routeCoordinates.length > 0 
    ? calculateRouteWithObstacles(routeCoordinates, currentObstacles)
    : [];

  return (
    <div style={{ height: '500px', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
      <MapContainer
        ref={mapRef}
        center={bounds[0] || [40.7128, -74.0060]}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapBounds bounds={bounds} />
        
        {/* Render stops */}
        {stops.map((stop, index) => {
          const isInRoute = route && route.route && route.route.includes(stop.id);
          const routeIndex = isInRoute ? route.route.indexOf(stop.id) + 1 : null;
          
          return (
            <Marker
              key={stop.id}
              position={[parseFloat(stop.latitude), parseFloat(stop.longitude)]}
              icon={createCustomIcon(
                isInRoute ? '#667eea' : '#64748b',
                routeIndex || (index + 1)
              )}
              eventHandlers={{
                click: () => onStopClick && onStopClick(stop)
              }}
            >
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>{stop.name}</h4>
                  <p style={{ margin: '4px 0', fontSize: '0.875rem', color: '#64748b' }}>
                    📍 {parseFloat(stop.latitude).toFixed(4)}, {parseFloat(stop.longitude).toFixed(4)}
                  </p>
                  {isInRoute && (
                    <p style={{ margin: '4px 0', fontSize: '0.875rem', color: '#667eea', fontWeight: 'bold' }}>
                      🚛 Stop #{routeIndex} in route
                    </p>
                  )}
                  <p style={{ margin: '4px 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                    Added: {new Date(stop.created_at).toLocaleDateString()}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
        
        {/* Render obstacles */}
        {currentObstacles.map((obstacle, index) => (
          <Marker
            key={`obstacle-${index}`}
            position={[obstacle.lat, obstacle.lng]}
            icon={obstacleIcon}
          >
            <Popup>
              <div>
                <h4 style={{ margin: '0 0 8px 0', color: '#ef4444' }}>⚠️ {obstacle.type}</h4>
                <p style={{ margin: '4px 0', fontSize: '0.875rem' }}>{obstacle.description}</p>
                <p style={{ margin: '4px 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                  Severity: {obstacle.severity}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
        
        {/* Render optimized route */}
        {optimizedRoute.length > 0 && (
          <AnimatedRoute
            route={optimizedRoute}
            isAnimating={isAnimating}
            onAnimationComplete={handleAnimationComplete}
          />
        )}
        
        {/* Render direct route for comparison (lighter color) */}
        {routeCoordinates.length > 0 && !isAnimating && (
          <Polyline
            positions={routeCoordinates}
            color="#e2e8f0"
            weight={2}
            opacity={0.5}
            dashArray="5, 10"
          />
        )}
        
        {/* Add map legend */}
        <div style={{ position: 'absolute', bottom: '10px', right: '10px', zIndex: 1000 }}>
          <MapLegend />
        </div>
      </MapContainer>
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
    const midLat = (start[0] + end[0]) / 2;
    const midLng = (start[1] + end[1]) / 2;
    
    // Create waypoint offset from the obstacle
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