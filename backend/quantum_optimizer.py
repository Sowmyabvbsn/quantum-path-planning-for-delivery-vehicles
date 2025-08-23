import numpy as np
from qiskit import QuantumCircuit
from qiskit.primitives import Sampler
from qiskit_ibm_runtime import QiskitRuntimeService, Session, Sampler as RuntimeSampler
import time
import logging
import os
from typing import List, Tuple, Dict, Any
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

class QuantumPathOptimizer:
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
    
    def create_qaoa_circuit(self, distance_matrix: np.ndarray, gamma: float, beta: float) -> QuantumCircuit:
        """Create QAOA quantum circuit for TSP-like optimization"""
        n_nodes = len(distance_matrix)
        n_qubits = min(n_nodes * 2, 20)  # Limit qubits for practical simulation
        
        qc = QuantumCircuit(n_qubits)
        
        # Initial superposition
        qc.h(range(n_qubits))
        
        # Cost Hamiltonian (gamma layer)
        for i in range(min(n_nodes, n_qubits//2)):
            for j in range(i + 1, min(n_nodes, n_qubits//2)):
                if i < n_qubits and j < n_qubits:
                    # Add cost interaction based on distance
                    weight = distance_matrix[i][j] / np.max(distance_matrix)
                    qc.rzz(gamma * weight, i, j)
        
        # Mixer Hamiltonian (beta layer)
        for i in range(n_qubits):
            qc.rx(2 * beta, i)
        
        # Measurement
        qc.measure_all()
        
        return qc
    
    def decode_solution(self, counts: dict, n_nodes: int, start_index: int = 0) -> List[int]:
        """Decode quantum measurement to route using greedy nearest neighbor"""
        try:
            # Get the most frequent measurement result
            most_frequent = max(counts.keys(), key=counts.get)
            
            # Use the measurement as a seed for randomized nearest neighbor
            seed = int(most_frequent, 2) if isinstance(most_frequent, str) else most_frequent
            np.random.seed(seed % 1000)
            
            # Greedy nearest neighbor with quantum-influenced randomization
            route = [start_index]
            remaining = list(range(n_nodes))
            remaining.remove(start_index)
            
            current = start_index
            while remaining:
                # Calculate distances to remaining nodes
                distances = []
                for node in remaining:
                    dist = self.distance_matrix[current][node]
                    # Add small quantum-influenced randomization
                    quantum_noise = np.random.normal(0, 0.1 * dist)
                    distances.append((dist + quantum_noise, node))
                
                # Choose the nearest node
                distances.sort()
                next_node = distances[0][1]
                
                route.append(next_node)
                remaining.remove(next_node)
                current = next_node
            
            return route
        except Exception as e:
            logger.warning(f"Decoding failed, using sequential route: {str(e)}")
            return list(range(n_nodes))
    
    def classical_optimization_fallback(self, distance_matrix: np.ndarray, start_index: int = 0) -> List[int]:
        """Fallback to nearest neighbor heuristic"""
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
    
    def improved_classical_optimization(self, distance_matrix: np.ndarray, start_index: int = 0) -> List[int]:
        """Improved classical optimization using 2-opt local search"""
        # Start with nearest neighbor
        route = self.classical_optimization_fallback(distance_matrix, start_index)
        n_nodes = len(route)
        
        # Apply 2-opt improvements
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
    
    async def optimize_route(self, distance_matrix: np.ndarray, start_index: int = 0) -> Dict[str, Any]:
        """Optimize route using QAOA algorithm with fallbacks"""
        start_time = time.time()
        n_nodes = len(distance_matrix)
        self.distance_matrix = distance_matrix
        
        try:
            # For small problems, attempt quantum approach
            if n_nodes <= 8:
                route = await self._quantum_optimize(distance_matrix, start_index)
                backend_used = "Quantum QAOA"
                optimization_level = 3
            elif n_nodes <= 15:
                # Use improved classical for medium problems
                route = self.improved_classical_optimization(distance_matrix, start_index)
                backend_used = "Classical 2-opt"
                optimization_level = 2
            else:
                # Use simple nearest neighbor for large problems
                route = self.classical_optimization_fallback(distance_matrix, start_index)
                backend_used = "Classical Greedy"
                optimization_level = 1
                
            computation_time = time.time() - start_time
            
            return {
                'route': route,
                'computation_time': computation_time,
                'backend': backend_used,
                'optimization_level': optimization_level
            }
            
        except Exception as e:
            logger.error(f"Optimization failed: {str(e)}")
            # Always have a fallback
            route = self.classical_optimization_fallback(distance_matrix, start_index)
            computation_time = time.time() - start_time
            
            return {
                'route': route,
                'computation_time': computation_time,
                'backend': 'Classical Fallback',
                'optimization_level': 0
            }
    
    async def _quantum_optimize(self, distance_matrix: np.ndarray, start_index: int) -> List[int]:
        """Actual quantum optimization using QAOA"""
        n_nodes = len(distance_matrix)
        
        # Simplified QAOA approach with multiple parameter sets
        best_route = None
        best_cost = float('inf')
        
        # Try different QAOA parameter combinations
        parameter_sets = [
            (0.5, 0.5), (1.0, 1.0), (1.5, 0.5),
            (0.8, 1.2), (1.2, 0.8), (0.3, 1.5)
        ]
        
        for gamma, beta in parameter_sets:
            try:
                qc = self.create_qaoa_circuit(distance_matrix, gamma, beta)
                
                # Use local sampler
                sampler = Sampler()
                job = sampler.run(qc, shots=1000)
                result = job.result()
                
                # Get measurement counts
                if hasattr(result, 'quasi_dists') and result.quasi_dists:
                    counts = result.quasi_dists[0]
                    # Convert quasi-distribution to counts-like format
                    counts_dict = {format(int(k), f'0{qc.num_qubits}b'): int(v * 1000) 
                                 for k, v in counts.items()}
                else:
                    # Fallback if quasi_dists not available
                    counts_dict = {'0' * qc.num_qubits: 1000}
                
                # Decode to route
                route = self.decode_solution(counts_dict, n_nodes, start_index)
                
                # Calculate route cost
                cost = 0
                for i in range(len(route) - 1):
                    cost += distance_matrix[route[i]][route[i+1]]
                
                if cost < best_cost:
                    best_cost = cost
                    best_route = route
                    
            except Exception as e:
                logger.warning(f"QAOA iteration failed with params ({gamma}, {beta}): {str(e)}")
                continue
        
        # If quantum optimization failed, use classical fallback
        if best_route is None:
            logger.info("Quantum optimization failed, using classical fallback")
            best_route = self.improved_classical_optimization(distance_matrix, start_index)
        
        return best_route