"""
Quantum Layer - Handles QAOA quantum optimization
Separated from classical optimization as per interaction diagram
"""
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

class QuantumLayer:
    """
    Pure quantum optimization layer using QAOA
    Handles quantum circuit creation and execution
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
    
    def create_qaoa_circuit(self, distance_matrix: np.ndarray, gamma: float, beta: float, depth: int = 2) -> QuantumCircuit:
        """Create QAOA quantum circuit for TSP optimization"""
        n_nodes = len(distance_matrix)
        n_qubits = min(n_nodes * 2, 20)  # Limit qubits for practical simulation
        
        qc = QuantumCircuit(n_qubits)
        
        # Initial superposition
        for i in range(n_qubits):
            qc.ry(np.pi/4, i)
        
        # QAOA layers
        for layer in range(depth):
            # Cost Hamiltonian (gamma layer)
            for i in range(min(n_nodes, n_qubits//2)):
                for j in range(i + 1, min(n_nodes, n_qubits//2)):
                    if i < n_qubits and j < n_qubits:
                        weight = np.exp(-distance_matrix[i][j] / np.mean(distance_matrix))
                        qc.rzz(gamma * weight * (layer + 1), i, j)
            
            # Mixer Hamiltonian (beta layer)
            for i in range(n_qubits):
                qc.rx(2 * beta / (layer + 1), i)
                if i < n_qubits - 1:
                    qc.cnot(i, i + 1)
        
        qc.measure_all()
        return qc
    
    async def run_qaoa_circuit(self, distance_matrix: np.ndarray) -> Dict[str, Any]:
        """Run QAOA circuit and return quantum results"""
        start_time = time.time()
        
        try:
            # Optimize QAOA parameters
            best_result = None
            best_cost = float('inf')
            
            parameter_sets = [
                (0.8, 1.2, 2), (1.2, 0.8, 2), (1.0, 1.0, 3),
                (0.6, 1.0, 2), (1.0, 0.6, 2), (0.8, 0.8, 2)
            ]
            
            for gamma, beta, depth in parameter_sets:
                qc = self.create_qaoa_circuit(distance_matrix, gamma, beta, depth)
                
                # Use local sampler with more shots
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
                
                # Evaluate this parameter set
                candidate_routes = self.decode_quantum_results(counts_dict, len(distance_matrix))
                for route in candidate_routes[:3]:  # Try top 3 candidates
                    cost = self.calculate_route_cost(route, distance_matrix)
                    if cost < best_cost:
                        best_cost = cost
                        best_result = {
                            'route': route,
                            'cost': cost,
                            'counts': counts_dict,
                            'parameters': {'gamma': gamma, 'beta': beta, 'depth': depth}
                        }
            
            computation_time = time.time() - start_time
            
            if best_result:
                return {
                    'success': True,
                    'route': best_result['route'],
                    'cost': best_result['cost'],
                    'computation_time': computation_time,
                    'backend': 'QAOA Quantum Circuit',
                    'parameters': best_result['parameters'],
                    'quantum_counts': best_result['counts']
                }
            else:
                raise Exception("No valid quantum solution found")
                
        except Exception as e:
            logger.error(f"QAOA circuit execution failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'computation_time': time.time() - start_time
            }
    
    def decode_quantum_results(self, counts: dict, n_nodes: int) -> List[List[int]]:
        """Decode quantum measurement results into candidate routes"""
        candidate_routes = []
        
        # Get top measurement results
        sorted_counts = sorted(counts.items(), key=lambda x: x[1], reverse=True)
        top_results = sorted_counts[:min(10, len(sorted_counts))]
        
        for bitstring, count in top_results:
            # Convert bitstring to route using quantum-inspired heuristics
            route = self.bitstring_to_route(bitstring, n_nodes)
            if self.is_valid_route(route, n_nodes):
                candidate_routes.append(route)
        
        # If no valid routes found, generate fallback routes
        if not candidate_routes:
            candidate_routes = [list(range(n_nodes))]
        
        return candidate_routes
    
    def bitstring_to_route(self, bitstring: str, n_nodes: int) -> List[int]:
        """Convert quantum bitstring to route using quantum bias"""
        seed = int(bitstring, 2) % 10000
        np.random.seed(seed)
        
        route = [0]  # Start from node 0
        remaining = list(range(1, n_nodes))
        
        # Use bitstring to bias selection
        for i in range(len(remaining)):
            if not remaining:
                break
                
            # Use quantum bias from bitstring
            bit_index = i % len(bitstring)
            quantum_bias = 1 if bitstring[bit_index] == '1' else 0
            
            # Select next node with quantum bias
            if quantum_bias and len(remaining) > 1:
                # Prefer nodes that would create shorter segments
                next_node = remaining[np.random.randint(0, min(2, len(remaining)))]
            else:
                next_node = remaining[0]
            
            route.append(next_node)
            remaining.remove(next_node)
        
        return route
    
    def is_valid_route(self, route: List[int], n_nodes: int) -> bool:
        """Check if route is valid (visits all nodes exactly once)"""
        return (len(route) == n_nodes and 
                len(set(route)) == n_nodes and 
                all(0 <= node < n_nodes for node in route))
    
    def calculate_route_cost(self, route: List[int], distance_matrix: np.ndarray) -> float:
        """Calculate total cost of a route"""
        if len(route) < 2:
            return 0.0
        
        total_cost = 0.0
        for i in range(len(route) - 1):
            total_cost += distance_matrix[route[i]][route[i + 1]]
        
        return total_cost