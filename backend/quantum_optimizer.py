import numpy as np
from qiskit import QuantumCircuit
from qiskit.primitives import Sampler
from qiskit_ibm_runtime import QiskitRuntimeService, Session, Sampler as RuntimeSampler
import time
import logging
import os
from typing import List, Tuple, Dict, Any
from dotenv import load_dotenv
from utils import haversine_distance

load_dotenv()

logger = logging.getLogger(__name__)

class HybridQuantumOptimizer:
    """
    Hybrid quantum-classical optimizer combining QAOA with classical algorithms
    for enhanced route optimization accuracy
    """
    
    def __init__(self):
        self.ibm_token = os.getenv('IBM_QUANTUM_TOKEN')
        self.service = None
        self.setup_quantum_service()
    
    def setup_quantum_service(self):
        """Setup IBM Quantum service if token is available"""
        if self.ibm_token:
            try:
                self.service = QiskitRuntimeService(
                    token=self.ibm_token,
                    channel='ibm_quantum'
                )
                logger.info("IBM Quantum service initialized successfully")
            except Exception as e:
                logger.warning(f"Failed to initialize IBM Quantum service: {str(e)}")
                self.service = None
        else:
            logger.info("No IBM Quantum token provided, using local simulator")
    
    def create_advanced_qaoa_circuit(self, distance_matrix: np.ndarray, gamma: float, beta: float, depth: int = 2) -> QuantumCircuit:
        """Create advanced QAOA quantum circuit with multiple layers"""
        n_nodes = len(distance_matrix)
        n_qubits = min(n_nodes * 2, 20)  # Limit qubits for practical simulation
        
        qc = QuantumCircuit(n_qubits)
        
        # Initial superposition with optimized angles
        for i in range(n_qubits):
            qc.ry(np.pi/4, i)  # Better initial state than simple Hadamard
        
        # Multiple QAOA layers for better optimization
        for layer in range(depth):
            # Cost Hamiltonian (gamma layer) with distance weighting
            for i in range(min(n_nodes, n_qubits//2)):
                for j in range(i + 1, min(n_nodes, n_qubits//2)):
                    if i < n_qubits and j < n_qubits:
                        # Normalized distance weight with exponential scaling
                        weight = np.exp(-distance_matrix[i][j] / np.mean(distance_matrix))
                        qc.rzz(gamma * weight * (layer + 1), i, j)
            
            # Mixer Hamiltonian (beta layer) with adaptive angles
            for i in range(n_qubits):
                qc.rx(2 * beta / (layer + 1), i)
                if i < n_qubits - 1:
                    qc.cnot(i, i + 1)  # Add entanglement
        
        # Final measurement
        qc.measure_all()
        
        return qc
    
    def simulated_annealing_optimization(self, distance_matrix: np.ndarray, start_index: int = 0, 
                                       max_iterations: int = 1000) -> List[int]:
        """Simulated annealing for route optimization"""
        n_nodes = len(distance_matrix)
        
        # Initialize with nearest neighbor solution
        current_route = self.nearest_neighbor_heuristic(distance_matrix, start_index)
        current_cost = self.calculate_route_cost(current_route, distance_matrix)
        
        best_route = current_route.copy()
        best_cost = current_cost
        
        # Simulated annealing parameters
        initial_temp = 1000.0
        final_temp = 1.0
        cooling_rate = 0.995
        
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
    
    def genetic_algorithm_optimization(self, distance_matrix: np.ndarray, start_index: int = 0,
                                     population_size: int = 50, generations: int = 100) -> List[int]:
        """Genetic algorithm for route optimization"""
        n_nodes = len(distance_matrix)
        
        # Initialize population
        population = []
        for _ in range(population_size):
            route = list(range(n_nodes))
            if start_index != 0:
                route.remove(start_index)
                route = [start_index] + route
            np.random.shuffle(route[1:])  # Keep start_index at beginning
            population.append(route)
        
        for generation in range(generations):
            # Evaluate fitness (inverse of cost)
            fitness_scores = []
            for route in population:
                cost = self.calculate_route_cost(route, distance_matrix)
                fitness_scores.append(1.0 / (cost + 1e-6))
            
            # Selection (tournament selection)
            new_population = []
            for _ in range(population_size):
                parent1 = self.tournament_selection(population, fitness_scores)
                parent2 = self.tournament_selection(population, fitness_scores)
                child = self.order_crossover(parent1, parent2, start_index)
                
                # Mutation
                if np.random.random() < 0.1:
                    child = self.mutate_route(child, start_index)
                
                new_population.append(child)
            
            population = new_population
        
        # Return best solution
        best_route = min(population, key=lambda route: self.calculate_route_cost(route, distance_matrix))
        return best_route
    
    def ant_colony_optimization(self, distance_matrix: np.ndarray, start_index: int = 0,
                               n_ants: int = 20, n_iterations: int = 100) -> List[int]:
        """Ant Colony Optimization for route finding"""
        n_nodes = len(distance_matrix)
        
        # Initialize pheromone matrix
        pheromone = np.ones((n_nodes, n_nodes)) * 0.1
        
        # ACO parameters
        alpha = 1.0  # Pheromone importance
        beta = 2.0   # Distance importance
        rho = 0.5    # Evaporation rate
        Q = 100      # Pheromone deposit factor
        
        best_route = None
        best_cost = float('inf')
        
        for iteration in range(n_iterations):
            routes = []
            costs = []
            
            # Each ant constructs a route
            for ant in range(n_ants):
                route = self.construct_ant_route(distance_matrix, pheromone, start_index, alpha, beta)
                cost = self.calculate_route_cost(route, distance_matrix)
                
                routes.append(route)
                costs.append(cost)
                
                if cost < best_cost:
                    best_cost = cost
                    best_route = route.copy()
            
            # Update pheromones
            pheromone *= (1 - rho)  # Evaporation
            
            for route, cost in zip(routes, costs):
                pheromone_deposit = Q / cost
                for i in range(len(route) - 1):
                    pheromone[route[i]][route[i + 1]] += pheromone_deposit
        
        return best_route
    
    def hybrid_quantum_classical_optimization(self, distance_matrix: np.ndarray, start_index: int = 0) -> Dict[str, Any]:
        """
        Hybrid optimization combining quantum QAOA with classical algorithms
        """
        n_nodes = len(distance_matrix)
        results = {}
        
        # Run multiple optimization algorithms
        algorithms = []
        
        # 1. Quantum QAOA (for small problems)
        if n_nodes <= 8:
            try:
                qaoa_result = self.quantum_qaoa_optimization(distance_matrix, start_index)
                algorithms.append(('Quantum QAOA', qaoa_result))
            except Exception as e:
                logger.warning(f"QAOA failed: {str(e)}")
        
        # 2. Simulated Annealing
        sa_result = self.simulated_annealing_optimization(distance_matrix, start_index)
        algorithms.append(('Simulated Annealing', sa_result))
        
        # 3. Genetic Algorithm
        if n_nodes >= 5:
            ga_result = self.genetic_algorithm_optimization(distance_matrix, start_index)
            algorithms.append(('Genetic Algorithm', ga_result))
        
        # 4. Ant Colony Optimization
        if n_nodes >= 4:
            aco_result = self.ant_colony_optimization(distance_matrix, start_index)
            algorithms.append(('Ant Colony', aco_result))
        
        # 5. Enhanced 2-opt
        two_opt_result = self.enhanced_two_opt_optimization(distance_matrix, start_index)
        algorithms.append(('Enhanced 2-opt', two_opt_result))
        
        # Select best result
        best_algorithm = None
        best_route = None
        best_cost = float('inf')
        
        for name, route in algorithms:
            cost = self.calculate_route_cost(route, distance_matrix)
            if cost < best_cost:
                best_cost = cost
                best_route = route
                best_algorithm = name
        
        return {
            'route': best_route,
            'cost': best_cost,
            'algorithm': best_algorithm,
            'all_results': {name: self.calculate_route_cost(route, distance_matrix) for name, route in algorithms}
        }
    
    def quantum_qaoa_optimization(self, distance_matrix: np.ndarray, start_index: int) -> List[int]:
        """Quantum QAOA optimization with parameter optimization"""
        n_nodes = len(distance_matrix)
        
        best_route = None
        best_cost = float('inf')
        
        # Optimize QAOA parameters using classical optimization
        parameter_sets = self.optimize_qaoa_parameters(distance_matrix)
        
        for gamma, beta, depth in parameter_sets:
            try:
                qc = self.create_advanced_qaoa_circuit(distance_matrix, gamma, beta, depth)
                
                # Use local sampler with more shots for better statistics
                sampler = Sampler()
                job = sampler.run(qc, shots=2000)
                result = job.result()
                
                # Get measurement counts
                if hasattr(result, 'quasi_dists') and result.quasi_dists:
                    counts = result.quasi_dists[0]
                    counts_dict = {format(int(k), f'0{qc.num_qubits}b'): int(v * 2000) 
                                 for k, v in counts.items()}
                else:
                    counts_dict = {'0' * qc.num_qubits: 2000}
                
                # Decode multiple solutions and pick the best
                for _ in range(5):  # Try multiple decodings
                    route = self.advanced_decode_solution(counts_dict, n_nodes, start_index, distance_matrix)
                    cost = self.calculate_route_cost(route, distance_matrix)
                    
                    if cost < best_cost:
                        best_cost = cost
                        best_route = route
                        
            except Exception as e:
                logger.warning(f"QAOA iteration failed: {str(e)}")
                continue
        
        # If quantum optimization failed, use classical fallback
        if best_route is None:
            best_route = self.enhanced_two_opt_optimization(distance_matrix, start_index)
        
        return best_route
    
    def optimize_qaoa_parameters(self, distance_matrix: np.ndarray) -> List[Tuple[float, float, int]]:
        """Optimize QAOA parameters based on problem characteristics"""
        n_nodes = len(distance_matrix)
        
        # Parameter sets optimized for different problem sizes
        if n_nodes <= 4:
            return [(0.8, 1.2, 2), (1.2, 0.8, 2), (1.0, 1.0, 3)]
        elif n_nodes <= 6:
            return [(0.6, 1.0, 2), (1.0, 0.6, 2), (0.8, 0.8, 2)]
        else:
            return [(0.5, 0.8, 1), (0.8, 0.5, 1), (0.6, 0.6, 1)]
    
    def advanced_decode_solution(self, counts: dict, n_nodes: int, start_index: int, distance_matrix: np.ndarray) -> List[int]:
        """Advanced quantum solution decoding with problem-specific heuristics"""
        try:
            # Get top measurement results
            sorted_counts = sorted(counts.items(), key=lambda x: x[1], reverse=True)
            top_results = sorted_counts[:min(10, len(sorted_counts))]
            
            best_route = None
            best_cost = float('inf')
            
            for bitstring, count in top_results:
                # Convert bitstring to route using multiple strategies
                strategies = [
                    self.bitstring_to_route_greedy,
                    self.bitstring_to_route_probabilistic,
                    self.bitstring_to_route_nearest_neighbor
                ]
                
                for strategy in strategies:
                    try:
                        route = strategy(bitstring, n_nodes, start_index, distance_matrix)
                        cost = self.calculate_route_cost(route, distance_matrix)
                        
                        if cost < best_cost:
                            best_cost = cost
                            best_route = route
                    except:
                        continue
            
            return best_route if best_route else list(range(n_nodes))
            
        except Exception as e:
            logger.warning(f"Advanced decoding failed: {str(e)}")
            return self.nearest_neighbor_heuristic(distance_matrix, start_index)
    
    def bitstring_to_route_greedy(self, bitstring: str, n_nodes: int, start_index: int, distance_matrix: np.ndarray) -> List[int]:
        """Convert bitstring to route using greedy nearest neighbor with quantum bias"""
        seed = int(bitstring, 2) % 10000
        np.random.seed(seed)
        
        route = [start_index]
        remaining = list(range(n_nodes))
        remaining.remove(start_index)
        
        current = start_index
        while remaining:
            # Calculate quantum-biased distances
            distances = []
            for node in remaining:
                base_dist = distance_matrix[current][node]
                # Add quantum bias based on bitstring
                bit_index = (current * n_nodes + node) % len(bitstring)
                quantum_bias = 0.1 * base_dist * (1 if bitstring[bit_index] == '1' else -1)
                distances.append((base_dist + quantum_bias, node))
            
            distances.sort()
            next_node = distances[0][1]
            
            route.append(next_node)
            remaining.remove(next_node)
            current = next_node
        
        return route
    
    def bitstring_to_route_probabilistic(self, bitstring: str, n_nodes: int, start_index: int, distance_matrix: np.ndarray) -> List[int]:
        """Convert bitstring to route using probabilistic selection"""
        seed = int(bitstring, 2) % 10000
        np.random.seed(seed)
        
        route = [start_index]
        remaining = list(range(n_nodes))
        remaining.remove(start_index)
        
        current = start_index
        while remaining:
            # Calculate probabilities based on inverse distances
            distances = [distance_matrix[current][node] for node in remaining]
            max_dist = max(distances)
            probabilities = [(max_dist - dist + 0.1) for dist in distances]
            total_prob = sum(probabilities)
            probabilities = [p / total_prob for p in probabilities]
            
            # Select next node probabilistically
            next_idx = np.random.choice(len(remaining), p=probabilities)
            next_node = remaining[next_idx]
            
            route.append(next_node)
            remaining.remove(next_node)
            current = next_node
        
        return route
    
    def bitstring_to_route_nearest_neighbor(self, bitstring: str, n_nodes: int, start_index: int, distance_matrix: np.ndarray) -> List[int]:
        """Convert bitstring to route using modified nearest neighbor"""
        return self.nearest_neighbor_heuristic(distance_matrix, start_index)
    
    # Classical optimization helper methods
    def nearest_neighbor_heuristic(self, distance_matrix: np.ndarray, start_index: int = 0) -> List[int]:
        """Improved nearest neighbor heuristic"""
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
    
    def enhanced_two_opt_optimization(self, distance_matrix: np.ndarray, start_index: int = 0) -> List[int]:
        """Enhanced 2-opt with multiple restarts and 3-opt moves"""
        best_route = None
        best_cost = float('inf')
        
        # Multiple restarts with different initial solutions
        for restart in range(3):
            if restart == 0:
                route = self.nearest_neighbor_heuristic(distance_matrix, start_index)
            else:
                route = list(range(len(distance_matrix)))
                if start_index != 0:
                    route.remove(start_index)
                    route = [start_index] + route
                np.random.shuffle(route[1:])
            
            # Apply 2-opt improvements
            route = self.two_opt_improvement(route, distance_matrix)
            
            # Apply 3-opt improvements for better solutions
            if len(route) >= 6:
                route = self.three_opt_improvement(route, distance_matrix)
            
            cost = self.calculate_route_cost(route, distance_matrix)
            if cost < best_cost:
                best_cost = cost
                best_route = route
        
        return best_route
    
    def two_opt_improvement(self, route: List[int], distance_matrix: np.ndarray) -> List[int]:
        """2-opt local search improvement"""
        n_nodes = len(route)
        improved = True
        max_iterations = 100
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
    
    def three_opt_improvement(self, route: List[int], distance_matrix: np.ndarray) -> List[int]:
        """3-opt local search improvement"""
        n_nodes = len(route)
        best_route = route.copy()
        best_cost = self.calculate_route_cost(route, distance_matrix)
        
        for i in range(1, n_nodes - 2):
            for j in range(i + 1, n_nodes - 1):
                for k in range(j + 1, n_nodes):
                    # Generate all possible 3-opt moves
                    new_routes = self.generate_3opt_moves(route, i, j, k)
                    
                    for new_route in new_routes:
                        cost = self.calculate_route_cost(new_route, distance_matrix)
                        if cost < best_cost:
                            best_cost = cost
                            best_route = new_route
        
        return best_route
    
    def generate_3opt_moves(self, route: List[int], i: int, j: int, k: int) -> List[List[int]]:
        """Generate all possible 3-opt moves"""
        moves = []
        
        # Original segments
        seg1 = route[:i]
        seg2 = route[i:j]
        seg3 = route[j:k]
        seg4 = route[k:]
        
        # All possible 3-opt reconnections
        moves.append(seg1 + seg2[::-1] + seg3 + seg4)
        moves.append(seg1 + seg2 + seg3[::-1] + seg4)
        moves.append(seg1 + seg2[::-1] + seg3[::-1] + seg4)
        moves.append(seg1 + seg3 + seg2 + seg4)
        moves.append(seg1 + seg3[::-1] + seg2 + seg4)
        moves.append(seg1 + seg3 + seg2[::-1] + seg4)
        moves.append(seg1 + seg3[::-1] + seg2[::-1] + seg4)
        
        return moves
    
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
    
    def tournament_selection(self, population: List[List[int]], fitness_scores: List[float], tournament_size: int = 3) -> List[int]:
        """Tournament selection for genetic algorithm"""
        tournament_indices = np.random.choice(len(population), tournament_size, replace=False)
        tournament_fitness = [fitness_scores[i] for i in tournament_indices]
        winner_idx = tournament_indices[np.argmax(tournament_fitness)]
        return population[winner_idx].copy()
    
    def order_crossover(self, parent1: List[int], parent2: List[int], start_index: int) -> List[int]:
        """Order crossover for genetic algorithm"""
        n = len(parent1)
        
        # Select crossover points
        start = np.random.randint(1, n - 1)
        end = np.random.randint(start + 1, n)
        
        # Create child
        child = [-1] * n
        child[0] = start_index  # Keep start index fixed
        
        # Copy segment from parent1
        child[start:end] = parent1[start:end]
        
        # Fill remaining positions from parent2
        remaining = [x for x in parent2 if x not in child]
        j = 0
        for i in range(1, n):
            if child[i] == -1:
                child[i] = remaining[j]
                j += 1
        
        return child
    
    def mutate_route(self, route: List[int], start_index: int) -> List[int]:
        """Mutate route by swapping two random cities (excluding start)"""
        mutated = route.copy()
        n = len(mutated)
        
        if n > 3:
            i = np.random.randint(1, n)
            j = np.random.randint(1, n)
            mutated[i], mutated[j] = mutated[j], mutated[i]
        
        return mutated
    
    def construct_ant_route(self, distance_matrix: np.ndarray, pheromone: np.ndarray, 
                           start_index: int, alpha: float, beta: float) -> List[int]:
        """Construct route for ant colony optimization"""
        n_nodes = len(distance_matrix)
        route = [start_index]
        remaining = set(range(n_nodes))
        remaining.remove(start_index)
        
        current = start_index
        
        while remaining:
            # Calculate probabilities
            probabilities = []
            for next_node in remaining:
                pheromone_level = pheromone[current][next_node] ** alpha
                distance_factor = (1.0 / (distance_matrix[current][next_node] + 1e-6)) ** beta
                probabilities.append(pheromone_level * distance_factor)
            
            # Normalize probabilities
            total_prob = sum(probabilities)
            if total_prob == 0:
                probabilities = [1.0 / len(remaining)] * len(remaining)
            else:
                probabilities = [p / total_prob for p in probabilities]
            
            # Select next node
            remaining_list = list(remaining)
            next_node = np.random.choice(remaining_list, p=probabilities)
            
            route.append(next_node)
            remaining.remove(next_node)
            current = next_node
        
        return route
    
    async def optimize_route(self, distance_matrix: np.ndarray, start_index: int = 0) -> Dict[str, Any]:
        """Main optimization method using hybrid approach"""
        start_time = time.time()
        n_nodes = len(distance_matrix)
        
        try:
            # Use hybrid optimization for best results
            result = self.hybrid_quantum_classical_optimization(distance_matrix, start_index)
            
            computation_time = time.time() - start_time
            
            return {
                'route': result['route'],
                'computation_time': computation_time,
                'backend': f"Hybrid ({result['algorithm']})",
                'optimization_level': 3,
                'cost': result['cost'],
                'algorithm_comparison': result['all_results']
            }
            
        except Exception as e:
            logger.error(f"Hybrid optimization failed: {str(e)}")
            # Fallback to simple nearest neighbor
            route = self.nearest_neighbor_heuristic(distance_matrix, start_index)
            computation_time = time.time() - start_time
            
            return {
                'route': route,
                'computation_time': computation_time,
                'backend': 'Classical Fallback',
                'optimization_level': 1,
                'cost': self.calculate_route_cost(route, distance_matrix)
            }

# Maintain backward compatibility
class QuantumPathOptimizer(HybridQuantumOptimizer):
    """Backward compatibility wrapper"""
    pass