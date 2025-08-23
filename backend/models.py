from pydantic import BaseModel, Field, validator
from typing import List, Optional, Any
from datetime import datetime

class Stop(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    
    @validator('name')
    def validate_name(cls, v):
        return v.strip()

class OptimizationRequest(BaseModel):
    stop_ids: List[int] = Field(..., min_items=2)
    start_index: Optional[int] = Field(0, ge=0)
    quantum_backend: Optional[str] = Field("qasm_simulator")
    optimization_level: Optional[int] = Field(1, ge=0, le=3)

class StopData(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float
    created_at: datetime

class OptimizationResponse(BaseModel):
    success: bool
    route: List[int]
    stops: List[dict]
    total_distance: float
    computation_time: float
    quantum_backend: str
    optimization_level: int
    message: Optional[str] = None

class RouteResult(BaseModel):
    id: int
    route_data: Any
    total_distance: float
    computation_time: float
    backend_used: str
    created_at: datetime