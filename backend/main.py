from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import pandas as pd
import io
import base64
from PIL import Image
from typing import List, Optional
import logging
from contextlib import asynccontextmanager

from models import Stop, OptimizationRequest, OptimizationResponse, RouteResult
from database import init_db, get_db_connection
from quantum_layer import QuantumLayer
from classical_optimizer import ClassicalOptimizer
from utils import calculate_distance_matrix

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database on startup
    init_db()
    logger.info("Database initialized")
    yield

app = FastAPI(
    title="Quantum Path Planning API",
    description="Quantum-powered route optimization for delivery vehicles using QAOA",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize quantum and classical layers
quantum_layer = QuantumLayer()
classical_optimizer = ClassicalOptimizer()

@app.get("/")
async def root():
    return {"message": "Quantum Path Planning API", "status": "active"}

@app.post("/api/stops", response_model=dict)
async def add_stop(stop: Stop):
    """Add a new stop manually"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        cursor.execute(
            "INSERT INTO stops (name, latitude, longitude) VALUES (%s, %s, %s)",
            (stop.name, stop.latitude, stop.longitude)
        )
        connection.commit()
        stop_id = cursor.lastrowid
        
        cursor.close()
        connection.close()
        
        return {"id": stop_id, "message": "Stop added successfully"}
    except Exception as e:
        logger.error(f"Error adding stop: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add stop: {str(e)}")

@app.post("/api/stops/upload")
async def upload_stops_csv(file: UploadFile = File(...)):
    """Upload stops from CSV file"""
    try:
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="File must be a CSV")
        
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        # Validate CSV columns
        required_columns = ['name', 'lat', 'lng']
        if not all(col in df.columns for col in required_columns):
            raise HTTPException(
                status_code=400, 
                detail=f"CSV must contain columns: {required_columns}"
            )
        
        connection = get_db_connection()
        cursor = connection.cursor()
        
        stops_added = 0
        for _, row in df.iterrows():
            try:
                cursor.execute(
                    "INSERT INTO stops (name, latitude, longitude) VALUES (%s, %s, %s)",
                    (row['name'], float(row['lat']), float(row['lng']))
                )
                stops_added += 1
            except Exception as e:
                logger.warning(f"Failed to add stop {row['name']}: {str(e)}")
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return {"message": f"Successfully uploaded {stops_added} stops"}
    except Exception as e:
        logger.error(f"Error uploading CSV: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload CSV: {str(e)}")

@app.get("/api/stops", response_model=List[dict])
async def get_stops():
    """Get all stops"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        cursor.execute("SELECT * FROM stops ORDER BY created_at DESC")
        rows = cursor.fetchall()
        
        # Get column names
        columns = [desc[0] for desc in cursor.description]
        
        # Convert to list of dictionaries
        stops = []
        for row in rows:
            stop_dict = dict(zip(columns, row))
            stops.append(stop_dict)
        
        cursor.close()
        connection.close()
        
        return stops
    except Exception as e:
        logger.error(f"Error fetching stops: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch stops: {str(e)}")

@app.delete("/api/stops/{stop_id}")
async def delete_stop(stop_id: int):
    """Delete a stop"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        cursor.execute("DELETE FROM stops WHERE id = %s", (stop_id,))
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Stop not found")
        
        connection.commit()
        cursor.close()
        connection.close()
        
        return {"message": "Stop deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting stop: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete stop: {str(e)}")

@app.post("/api/optimize", response_model=OptimizationResponse)
async def optimize_route(request: OptimizationRequest):
    """
    Optimize route using hybrid quantum-classical approach
    Following the interaction diagram:
    1. Store/Fetch stops & route data
    2. Calculate Distance Matrix (Haversine)
    3. Send distance matrix to Quantum Layer
    4. Run QAOA Circuit
    5. Forward candidate routes to Classical Post-Processing
    6. Return optimized route
    """
    try:
        if len(request.stop_ids) < 2:
            raise HTTPException(status_code=400, detail="At least 2 stops required for optimization")
        
        # Step 1: Store/Fetch stops & route data
        connection = get_db_connection()
        cursor = connection.cursor()
        
        placeholders = ','.join(['%s'] * len(request.stop_ids))
        cursor.execute(f"SELECT * FROM stops WHERE id IN ({placeholders})", request.stop_ids)
        rows = cursor.fetchall()
        
        # Get column names and convert to dictionaries
        columns = [desc[0] for desc in cursor.description]
        stops_data = []
        for row in rows:
            stop_dict = dict(zip(columns, row))
            stops_data.append(stop_dict)
        
        cursor.close()
        connection.close()
        
        if len(stops_data) != len(request.stop_ids):
            raise HTTPException(status_code=400, detail="Some stops not found")
        
        # Step 2: Calculate Distance Matrix (Haversine)
        coordinates = [(stop['latitude'], stop['longitude']) for stop in stops_data]
        distance_matrix = calculate_distance_matrix(coordinates)
        
        # Step 3 & 4: Send distance matrix to Quantum Layer → Run QAOA Circuit
        logger.info("Starting quantum layer optimization...")
        quantum_result = await quantum_layer.run_qaoa_circuit(distance_matrix)
        
        # Step 5: Forward candidate routes to Classical Post-Processing
        logger.info("Starting classical post-processing...")
        if quantum_result['success']:
            # Use quantum candidate routes for classical optimization
            candidate_routes = [quantum_result['route']]
        else:
            # Fallback to pure classical if quantum fails
            candidate_routes = []
        
        classical_result = classical_optimizer.heuristic_optimization(
            candidate_routes, distance_matrix
        )
        
        # Step 6: Return optimized route
        # Combine results
        total_computation_time = quantum_result.get('computation_time', 0) + classical_result['computation_time']
        
        # Apply start index offset
        start_index = request.start_index or 0
        if start_index > 0 and start_index < len(classical_result['route']):
            route = classical_result['route']
            # Rotate route to start from specified index
            start_pos = route.index(start_index) if start_index in route else 0
            optimized_route = route[start_pos:] + route[:start_pos]
        else:
            optimized_route = classical_result['route']
        
        # Prepare response
        optimized_stops = [stops_data[i] for i in optimized_route]
        
        # Calculate total distance
        total_distance = 0
        for i in range(len(optimized_route) - 1):
            from_idx = optimized_route[i]
            to_idx = optimized_route[i + 1]
            total_distance += distance_matrix[from_idx][to_idx]
        
        # Determine backend description
        if quantum_result['success']:
            backend_desc = f"Hybrid (Quantum QAOA + {classical_result['method']})"
        else:
            backend_desc = f"Classical Fallback ({classical_result['method']})"
        
        # Store optimization result in database for history
        try:
            connection = get_db_connection()
            cursor = connection.cursor()
            
            cursor.execute("""
                INSERT INTO optimization_results 
                (route_data, total_distance, computation_time, backend_used, optimization_level, stop_count)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                str(optimized_route),
                total_distance,
                total_computation_time,
                backend_desc,
                request.optimization_level or 1,
                len(optimized_stops)
            ))
            
            connection.commit()
            cursor.close()
            connection.close()
        except Exception as e:
            logger.warning(f"Failed to store optimization result: {str(e)}")
        
        return OptimizationResponse(
            success=True,
            route=optimized_route,
            stops=optimized_stops,
            total_distance=round(total_distance, 2),
            computation_time=total_computation_time,
            quantum_backend=backend_desc,
            optimization_level=request.optimization_level or 1
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in optimization: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")

@app.get("/api/routes", response_model=List[RouteResult])
async def get_optimization_history():
    """Get optimization history"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        cursor.execute("""
            SELECT * FROM optimization_results 
            ORDER BY created_at DESC 
            LIMIT 50
        """)
        rows = cursor.fetchall()
        
        # Get column names and convert to dictionaries
        columns = [desc[0] for desc in cursor.description]
        results = []
        for row in rows:
            result_dict = dict(zip(columns, row))
            results.append(result_dict)
        
        cursor.close()
        connection.close()
        
        return results
    except Exception as e:
        logger.error(f"Error fetching optimization history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)