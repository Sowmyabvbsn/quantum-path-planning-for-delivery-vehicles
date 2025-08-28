# 🚀 Quantum Path Planning for Delivery Vehicles

A cutting-edge quantum-classical hybrid application that optimizes delivery vehicle routes using quantum computing algorithms (QAOA) combined with Google Cloud APIs for real-world traffic and location data.

## 🌟 Overview

This application leverages the power of quantum computing to solve the Traveling Salesman Problem (TSP) for delivery route optimization, enhanced with Google Cloud's premium APIs for accurate geocoding, real-time traffic data, and comprehensive location services.

## 🚀 Features

- **Quantum-Classical Hybrid Optimization**: Combines QAOA quantum algorithms with classical post-processing
- **Google Cloud Integration**: Premium APIs for geocoding, directions, traffic, and places
- **Interactive Map Interface**: Real-time route visualization with Google Maps integration
- **Multiple Input Methods**: Manual entry, CSV upload, OCR from images
- **Current Location Integration**: GPS-based starting point selection
- **Real-time Progress Tracking**: Live updates during quantum optimization
- **Database Persistence**: MySQL storage for stops and optimization history
- **Traffic-Aware Routing**: Real-time traffic data from Google Maps
- **Advanced Geocoding**: High-precision address resolution with Google Cloud APIs

## 🏗️ Architecture

### Frontend (React + Vite)
- **React 18** with modern hooks and context
- **Leaflet** with Google Maps tiles for interactive mapping
- **Axios** for API communication
- **Real-time WebSocket** updates for optimization progress

### Backend (FastAPI + Python)
- **FastAPI** for high-performance REST API
- **IBM Qiskit** for quantum circuit execution
- **Google Cloud APIs** for geocoding and traffic data
- **MySQL** for data persistence
- **Hybrid optimization** combining quantum and classical algorithms

### Quantum Layer
- **QAOA (Quantum Approximate Optimization Algorithm)** for route optimization
- **IBM Quantum** backend integration (optional)
- **Classical post-processing** with 2-opt and simulated annealing

## 🔧 Google Cloud APIs Integration

This application now uses Google Cloud APIs instead of free alternatives for superior accuracy and reliability:

### Replaced Services:
- **Geocoding**: Google Cloud Geocoding API (replaces Nominatim, OpenCage)
- **Traffic Data**: Google Maps Traffic API (replaces HERE, TomTom)
- **Places**: Google Places API (replaces various event APIs)
- **Directions**: Google Directions API with traffic optimization
- **Maps**: Google Maps tiles (replaces OpenStreetMap)

### API Key Configuration:
```bash
GOOGLE_CLOUD_API_KEY=AIzaSyD4N9C7tE_VFlPUjVaAOdSQZNoGO9OTM7w
```

## 📦 Installation

### Prerequisites
- **Node.js** 18+ and npm
- **Python** 3.9+
- **MySQL** 8.0+
- **Google Cloud API Key** (provided)

### Frontend Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Set up environment variables
cp ../.env.example .env
# Edit .env with your configuration

# Initialize database
python database.py

# Start the server
python main.py
```

## 🔑 Environment Configuration

### Frontend (.env.local)
```bash
VITE_GOOGLE_MAPS_API_KEY=AIzaSyD4N9C7tE_VFlPUjVaAOdSQZNoGO9OTM7w
VITE_API_URL=http://localhost:8000
```

### Backend (.env)
```bash
GOOGLE_CLOUD_API_KEY=AIzaSyD4N9C7tE_VFlPUjVaAOdSQZNoGO9OTM7w
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=quantum_routing
IBM_QUANTUM_TOKEN=your_token_here  # Optional
```

## 🚀 Usage

1. **Start the Backend**: Run `python main.py` in the backend directory
2. **Start the Frontend**: Run `npm run dev` in the root directory
3. **Access the Application**: Open `http://localhost:5173`
4. **Add Delivery Stops**: Use manual entry, CSV upload, or OCR
5. **Optimize Routes**: Click "Optimize with Quantum" to start the hybrid optimization
6. **View Results**: Interactive map shows the optimized route with real-time traffic data

## 🧮 Quantum Algorithm

The application uses **QAOA (Quantum Approximate Optimization Algorithm)** to solve the Traveling Salesman Problem:

1. **Problem Encoding**: Convert TSP to QUBO (Quadratic Unconstrained Binary Optimization)
2. **Quantum Circuit**: Create parameterized QAOA circuit
3. **Optimization**: Use classical optimizer to find optimal parameters
4. **Post-processing**: Apply classical algorithms (2-opt, simulated annealing) to refine results

## 🌐 API Endpoints

### Stops Management
- `GET /api/stops` - Get all stops
- `POST /api/stops` - Add new stop
- `PUT /api/stops/{id}` - Update stop
- `DELETE /api/stops/{id}` - Delete stop

### Route Optimization
- `POST /api/optimize` - Start quantum-classical optimization

### Google Cloud Services
- `POST /api/geocode` - Geocode address
- `POST /api/reverse-geocode` - Reverse geocode coordinates
- `POST /api/directions` - Get directions with traffic
- `POST /api/places/nearby` - Search nearby places

## 🔧 Technology Stack

### Frontend
- React 18, Vite, Leaflet, Axios, Google Maps Integration

### Backend
- FastAPI, Python 3.9+, IBM Qiskit, Google Cloud APIs, MySQL

### Quantum Computing
- IBM Qiskit, QAOA Algorithm, Quantum Circuit Optimization

### Cloud Services
- Google Cloud Geocoding API
- Google Maps Directions API
- Google Places API
- Google Maps JavaScript API

## 📊 Performance

- **Quantum Advantage**: Explores solution space more efficiently than classical algorithms
- **Google Cloud APIs**: 99.9% uptime and high-precision data
- **Hybrid Approach**: Combines quantum exploration with classical refinement
- **Real-time Traffic**: Dynamic route optimization based on current conditions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **IBM Qiskit** for quantum computing framework
- **Google Cloud** for premium mapping and location services
- **FastAPI** for high-performance backend framework
- **React** and **Vite** for modern frontend development
