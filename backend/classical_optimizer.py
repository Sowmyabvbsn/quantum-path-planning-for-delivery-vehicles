"""
Classical Optimizer - Handles post-processing and heuristic optimization
Separated from quantum layer as per interaction diagram
"""
import numpy as np
import time
import logging
from typing import List, Tuple, Dict, Any

logger = logging.getLogger(__name__)

class ClassicalOptimizer:
    """
    Classical optimization layer for post-processing quantum results
    and running heuristic algorithms
    """
    
    def __init__(self):
        pass
    
    def heuristic_optimization(self, candidate_routes: List[List[int]], distance_matrix: np.ndarray) -> Dict[str, Any]:
        """Apply heuristic optimization to candidate routes"""
        start_time = time.time()
        
        best_route = None
        best_cost = float('inf')
        
        # Process each candidate route
        for route in candidate_routes:
            # Apply multiple optimization techniques
            optimized_routes = [
                self.two_opt_optimization(route.copy(), distance_matrix),
                self.nearest_neighbor_improvement(route.copy(), distance_matrix),
                self.simulated_annealing(route.copy(), distance_matrix, max_iterations=100)
            ]
            
            # Find best result
            for opt_route in optimized_routes:
                cost = self.calculate_route_cost(opt_route, distance_matrix)
                if cost < best_cost:
                    best_cost = cost
                    best_route = opt_route
        
        # If no candidates provided, use pure classical approach
        if not candidate_routes:
            best_route = self.nearest_neighbor_heuristic(distance_matrix)
            best_cost = self.calculate_route_cost(best_route, distance_matrix)
        
        computation_time = time.time() - start_time
        
        return {
            'route': best_route,
            'cost': best_cost,
            'computation_time': computation_time,
            'method': 'Classical Heuristic Optimization'
        }
    
    def two_opt_optimization(self, route: List[int], distance_matrix: np.ndarray) -> List[int]:
        """2-opt local search improvement"""
        n_nodes = len(route)
        improved = True
        max_iterations = 50
        iteration = 0
        
        while improved and iteration < max_iterations:
            improved = False
            iteration += 1
            
            for i in range(1, n_nodes - 1):
                for j in range(i + 1, n_nodes):
                    # Calculate current distance
                    current_dist = (
                        distance_matrix[route[i-1]][route[i]] +
                        distance_matrix[route[j]][route[(j+1) % n_nodes]]
                    )
                    
                    # Calculate distance after 2-opt swap
                    new_dist = (
                        distance_matrix[route[i-1]][route[j]] +
                        distance_matrix[route[i]][route[(j+1) % n_nodes]]
                    )
                    
                    # If improvement found, apply 2-opt swap
                    if new_dist < current_dist:
                        route[i:j+1] = route[i:j+1][::-1]
                        improved = True
        
        return route
    
    def nearest_neighbor_improvement(self, route: List[int], distance_matrix: np.ndarray) -> List[int]:
        """Improve route using nearest neighbor principles"""
        n_nodes = len(route)
        improved_route = [route[0]]  # Keep starting point
        remaining = set(route[1:])
        
        current = route[0]
        while remaining:
            # Find nearest unvisited node
            nearest = min(remaining, key=lambda x: distance_matrix[current][x])
            improved_route.append(nearest)
            remaining.remove(nearest)
            current = nearest
        
        return improved_route
    
    def simulated_annealing(self, route: List[int], distance_matrix: np.ndarray, max_iterations: int = 100) -> List[int]:
        """Simulated annealing optimization"""
        current_route = route.copy()
        current_cost = self.calculate_route_cost(current_route, distance_matrix)
        
        best_route = current_route.copy()
        best_cost = current_cost
        
        # Simulated annealing parameters
        initial_temp = 100.0
        final_temp = 1.0
        cooling_rate = 0.95
        
        temperature = initial_temp
        
        for iteration in range(max_iterations):
            # Generate neighbor solution using 2-opt swap
            new_route = self.two_opt_swap(current_route.copy())
            new_cost = self.calculate_route_cost(new_route, distance_matrix)
            
            # Accept or reject the new solution
            if new_cost < current_cost or np.random.random() < np.exp(-(new_cost - current_cost) / temperature):
                current_route = new_route
                current_cost = new_cost
                
                if new_cost < best_cost:
                    best_route = new_route.copy()
                    best_cost = new_cost
            
            # Cool down
            temperature *= cooling_rate
            
            if temperature < final_temp:
                break
        
        return best_route
    
    def nearest_neighbor_heuristic(self, distance_matrix: np.ndarray, start_index: int = 0) -> List[int]:
        """Pure nearest neighbor heuristic"""
        n_nodes = len(distance_matrix)
        route = [start_index]
        remaining = set(range(n_nodes))
        remaining.remove(start_index)
        
        current = start_index
        while remaining:
            nearest = min(remaining, key=lambda x: distance_matrix[current][x])
            route.append(nearest)
            remaining.remove(nearest)
            current = nearest
        
        return route
    
    def two_opt_swap(self, route: List[int]) -> List[int]:
        """Perform a random 2-opt swap"""
        n = len(route)
        if n < 4:
            return route
        
        i = np.random.randint(1, n - 1)
        j = np.random.randint(i + 1, n)
        
        new_route = route.copy()
        new_route[i:j+1] = new_route[i:j+1][::-1]
        return new_route
    
    def calculate_route_cost(self, route: List[int], distance_matrix: np.ndarray) -> float:
        """Calculate total cost of a route"""
        if len(route) < 2:
            return 0.0
        
        total_cost = 0.0
        for i in range(len(route) - 1):
            total_cost += distance_matrix[route[i]][route[i + 1]]
        
        return total_cost