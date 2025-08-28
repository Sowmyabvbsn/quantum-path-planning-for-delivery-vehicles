"""
Google Cloud Services Integration
Provides geocoding, directions, and places services using Google Cloud APIs
"""
import os
import requests
import logging
from typing import List, Dict, Any, Optional, Tuple
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

class GoogleCloudService:
    """
    Google Cloud APIs integration for geocoding, directions, and places
    """
    
    def __init__(self):
        self.api_key = os.getenv('GOOGLE_CLOUD_API_KEY')
        self.base_urls = {
            'geocoding': 'https://maps.googleapis.com/maps/api/geocode/json',
            'directions': 'https://maps.googleapis.com/maps/api/directions/json',
            'places': 'https://maps.googleapis.com/maps/api/place',
            'roads': 'https://roads.googleapis.com/v1',
            'distance_matrix': 'https://maps.googleapis.com/maps/api/distancematrix/json'
        }
        
        if not self.api_key:
            logger.warning("Google Cloud API key not found. Some features may not work.")
    
    async def geocode_address(self, address: str, **kwargs) -> Dict[str, Any]:
        """Geocode an address using Google Geocoding API"""
        if not self.api_key:
            raise ValueError("Google Cloud API key not configured")
        
        params = {
            'address': address,
            'key': self.api_key
        }
        
        # Add optional parameters
        if 'region' in kwargs:
            params['region'] = kwargs['region']
        if 'bounds' in kwargs:
            params['bounds'] = kwargs['bounds']
        if 'components' in kwargs:
            params['components'] = kwargs['components']
        
        try:
            response = requests.get(self.base_urls['geocoding'], params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data['status'] == 'OK':
                return {
                    'success': True,
                    'results': data['results']
                }
            else:
                return {
                    'success': False,
                    'error': data.get('error_message', f"Geocoding failed: {data['status']}")
                }
        except Exception as e:
            logger.error(f"Geocoding error: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def reverse_geocode(self, lat: float, lng: float, **kwargs) -> Dict[str, Any]:
        """Reverse geocode coordinates using Google Geocoding API"""
        if not self.api_key:
            raise ValueError("Google Cloud API key not configured")
        
        params = {
            'latlng': f"{lat},{lng}",
            'key': self.api_key
        }
        
        # Add optional parameters
        if 'result_type' in kwargs:
            params['result_type'] = kwargs['result_type']
        if 'location_type' in kwargs:
            params['location_type'] = kwargs['location_type']
        
        try:
            response = requests.get(self.base_urls['geocoding'], params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data['status'] == 'OK':
                return {
                    'success': True,
                    'results': data['results']
                }
            else:
                return {
                    'success': False,
                    'error': data.get('error_message', f"Reverse geocoding failed: {data['status']}")
                }
        except Exception as e:
            logger.error(f"Reverse geocoding error: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def get_directions(self, origin: str, destination: str, waypoints: List[str] = None, **kwargs) -> Dict[str, Any]:
        """Get directions using Google Directions API"""
        if not self.api_key:
            raise ValueError("Google Cloud API key not configured")
        
        params = {
            'origin': origin,
            'destination': destination,
            'key': self.api_key,
            'departure_time': 'now',
            'traffic_model': 'best_guess'
        }
        
        if waypoints:
            params['waypoints'] = '|'.join(waypoints)
        
        # Add optional parameters
        if 'avoid' in kwargs:
            params['avoid'] = kwargs['avoid']
        if 'mode' in kwargs:
            params['mode'] = kwargs['mode']
        if 'optimize' in kwargs and kwargs['optimize']:
            params['waypoints'] = 'optimize:true|' + (params.get('waypoints', ''))
        
        try:
            response = requests.get(self.base_urls['directions'], params=params, timeout=15)
            response.raise_for_status()
            data = response.json()
            
            if data['status'] == 'OK':
                return {
                    'success': True,
                    'routes': data['routes']
                }
            else:
                return {
                    'success': False,
                    'error': data.get('error_message', f"Directions failed: {data['status']}")
                }
        except Exception as e:
            logger.error(f"Directions error: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def search_nearby_places(self, location: str, radius: int = 5000, place_type: str = None, **kwargs) -> Dict[str, Any]:
        """Search for nearby places using Google Places API"""
        if not self.api_key:
            raise ValueError("Google Cloud API key not configured")
        
        params = {
            'location': location,
            'radius': radius,
            'key': self.api_key
        }
        
        if place_type:
            params['type'] = place_type
        
        # Add optional parameters
        if 'keyword' in kwargs:
            params['keyword'] = kwargs['keyword']
        if 'name' in kwargs:
            params['name'] = kwargs['name']
        
        try:
            response = requests.get(f"{self.base_urls['places']}/nearbysearch/json", params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data['status'] == 'OK':
                return {
                    'success': True,
                    'results': data['results']
                }
            else:
                return {
                    'success': False,
                    'error': data.get('error_message', f"Places search failed: {data['status']}")
                }
        except Exception as e:
            logger.error(f"Places search error: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def get_distance_matrix(self, origins: List[str], destinations: List[str], **kwargs) -> Dict[str, Any]:
        """Get distance matrix using Google Distance Matrix API"""
        if not self.api_key:
            raise ValueError("Google Cloud API key not configured")
        
        params = {
            'origins': '|'.join(origins),
            'destinations': '|'.join(destinations),
            'key': self.api_key,
            'departure_time': 'now',
            'traffic_model': 'best_guess'
        }
        
        # Add optional parameters
        if 'mode' in kwargs:
            params['mode'] = kwargs['mode']
        if 'avoid' in kwargs:
            params['avoid'] = kwargs['avoid']
        
        try:
            response = requests.get(self.base_urls['distance_matrix'], params=params, timeout=15)
            response.raise_for_status()
            data = response.json()
            
            if data['status'] == 'OK':
                return {
                    'success': True,
                    'rows': data['rows']
                }
            else:
                return {
                    'success': False,
                    'error': data.get('error_message', f"Distance matrix failed: {data['status']}")
                }
        except Exception as e:
            logger.error(f"Distance matrix error: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def snap_to_roads(self, path: List[Tuple[float, float]], interpolate: bool = True) -> Dict[str, Any]:
        """Snap coordinates to roads using Google Roads API"""
        if not self.api_key:
            raise ValueError("Google Cloud API key not configured")
        
        path_str = '|'.join([f"{lat},{lng}" for lat, lng in path])
        
        params = {
            'path': path_str,
            'interpolate': interpolate,
            'key': self.api_key
        }
        
        try:
            response = requests.get(f"{self.base_urls['roads']}/snapToRoads", params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            return {
                'success': True,
                'snapped_points': data.get('snappedPoints', [])
            }
        except Exception as e:
            logger.error(f"Roads API error: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def format_coordinates(self, lat: float, lng: float) -> str:
        """Format coordinates for API calls"""
        return f"{lat},{lng}"
    
    def parse_geometry(self, geometry: Dict[str, Any]) -> Dict[str, float]:
        """Parse geometry from API response"""
        location = geometry.get('location', {})
        return {
            'latitude': location.get('lat', 0.0),
            'longitude': location.get('lng', 0.0)
        }

# Create singleton instance
google_cloud_service = GoogleCloudService()
