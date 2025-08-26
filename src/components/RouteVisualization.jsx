import React, { useEffect, useState } from 'react';
import mapService from '../services/mapService';

function RouteVisualization({ route, stops, onRouteUpdate }) {
  const [routeGeometry, setRouteGeometry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Generate route overlay dynamically as per interaction diagram
  useEffect(() => {
    if (route && route.route && route.route.length >= 2) {
      generateRouteOverlay();
    }
  }, [route, stops]);

  const generateRouteOverlay = async () => {
    setLoading(true);
    setError(null);

    try {
      // Convert route indices to coordinates
      const coordinates = route.route.map(stopIndex => {
        const stop = stops.find(s => s.id === stopIndex) || stops[stopIndex];
        return stop ? [parseFloat(stop.latitude), parseFloat(stop.longitude)] : null;
      }).filter(Boolean);

      if (coordinates.length < 2) {
        throw new Error('Insufficient valid coordinates for route');
      }

      // Get route geometry from map service
      const routeData = await mapService.getRoute(coordinates, 'driving');
      
      if (routeData) {
        setRouteGeometry({
          coordinates: routeData.coordinates,
          distance: routeData.distance,
          duration: routeData.duration,
          geometry: routeData.geometry
        });

        // Notify parent component of route update
        if (onRouteUpdate) {
          onRouteUpdate({
            ...route,
            geometry: routeData.geometry,
            actualDistance: routeData.distance,
            estimatedDuration: routeData.duration
          });
        }
      } else {
        // Fallback to straight line connections
        setRouteGeometry({
          coordinates: coordinates,
          distance: calculateStraightLineDistance(coordinates),
          duration: null,
          geometry: null
        });
      }

    } catch (err) {
      console.error('Error generating route overlay:', err);
      setError(err.message);
      
      // Fallback to basic route visualization
      const coordinates = route.route.map(stopIndex => {
        const stop = stops.find(s => s.id === stopIndex) || stops[stopIndex];
        return stop ? [parseFloat(stop.latitude), parseFloat(stop.longitude)] : null;
      }).filter(Boolean);

      setRouteGeometry({
        coordinates: coordinates,
        distance: calculateStraightLineDistance(coordinates),
        duration: null,
        geometry: null
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStraightLineDistance = (coordinates) => {
    let totalDistance = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      totalDistance += calculateDistance(
        coordinates[i][0], coordinates[i][1],
        coordinates[i + 1][0], coordinates[i + 1][1]
      );
    }
    return totalDistance;
  };

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  return {
    routeGeometry,
    loading,
    error,
    regenerateRoute: generateRouteOverlay
  };
}

export default RouteVisualization;