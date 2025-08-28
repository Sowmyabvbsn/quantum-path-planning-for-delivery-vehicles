// API service for backend communication with Google Cloud integration
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    
    if (error.response) {
      throw new Error(error.response.data.detail || 'Server error occurred');
    } else if (error.request) {
      throw new Error('Unable to connect to server. Please check if the backend is running.');
    } else {
      throw new Error('Request failed');
    }
  }
);

export const addStop = async (stop) => {
  const response = await api.post('/api/stops', stop);
  return response.data;
};

export const getAllStops = async () => {
  const response = await api.get('/api/stops');
  return response.data;
};

export const deleteStop = async (stopId) => {
  const response = await api.delete(`/api/stops/${stopId}`);
  return response.data;
};

export const uploadCSV = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/api/stops/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return response.data;
};

export const optimizeRoute = async (request) => {
  const response = await api.post('/api/optimize', request);
  return response.data;
};

export const getOptimizationHistory = async () => {
  const response = await api.get('/api/routes');
  return response.data;
};

// Health check
export const checkServerHealth = async () => {
  try {
    const response = await api.get('/');
    return response.data;
  } catch (error) {
    throw new Error('Server is not responding');
  }
};

// Google Cloud API services
export const geocodeAddress = async (address, options = {}) => {
  const response = await api.post('/api/geocode', { address, ...options });
  return response.data;
};

export const reverseGeocode = async (lat, lng, options = {}) => {
  const response = await api.post('/api/reverse-geocode', { lat, lng, ...options });
  return response.data;
};

export const getDirections = async (origin, destination, waypoints = [], options = {}) => {
  const response = await api.post('/api/directions', { origin, destination, waypoints, ...options });
  return response.data;
};

export const searchNearbyPlaces = async (location, radius = 5000, type = null, options = {}) => {
  const response = await api.post('/api/places/nearby', { location, radius, type, ...options });
  return response.data;
};

// Road-following route service
export const getRoadFollowingRoute = async (stops, options = {}) => {
  const response = await api.post('/api/route/road-following', { stops, options });
  return response.data;
};