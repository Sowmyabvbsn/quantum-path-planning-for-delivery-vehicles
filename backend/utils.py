import numpy as np
import math
from typing import List, Tuple

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees) using Haversine formula
    Returns distance in kilometers
    """
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    # Radius of earth in kilometers
    r = 6371
    
    return c * r

def calculate_distance_matrix(coordinates: List[Tuple[float, float]]) -> np.ndarray:
    """
    Calculate distance matrix for all coordinate pairs using Haversine formula
    """
    n = len(coordinates)
    matrix = np.zeros((n, n))
    
    for i in range(n):
        for j in range(i + 1, n):
            lat1, lon1 = coordinates[i]
            lat2, lon2 = coordinates[j]
            distance = haversine_distance(lat1, lon1, lat2, lon2)
            matrix[i][j] = distance
            matrix[j][i] = distance  # Symmetric matrix
    
    return matrix

def validate_coordinates(lat: float, lon: float) -> bool:
    """Validate latitude and longitude coordinates"""
    return -90 <= lat <= 90 and -180 <= lon <= 180

def format_distance(distance_km: float) -> str:
    """Format distance for display"""
    if distance_km < 1:
        return f"{distance_km * 1000:.0f} m"
    else:
        return f"{distance_km:.2f} km"

def calculate_route_statistics(route: List[int], distance_matrix: np.ndarray) -> dict:
    """Calculate statistics for a route"""
    if len(route) < 2:
        return {
            'total_distance': 0,
            'average_segment': 0,
            'longest_segment': 0,
            'shortest_segment': 0
        }
    
    segments = []
    total_distance = 0
    
    for i in range(len(route) - 1):
        segment_distance = distance_matrix[route[i]][route[i + 1]]
        segments.append(segment_distance)
        total_distance += segment_distance
    
    return {
        'total_distance': total_distance,
        'average_segment': np.mean(segments),
        'longest_segment': np.max(segments),
        'shortest_segment': np.min(segments),
        'segment_count': len(segments)
    }