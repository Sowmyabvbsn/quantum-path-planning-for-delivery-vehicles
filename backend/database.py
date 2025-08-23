import pymysql
import logging
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'quantum_routing'),
    'charset': 'utf8mb4',
    'autocommit': False
}

def get_db_connection():
    """Get database connection"""
    try:
        connection = pymysql.connect(**DB_CONFIG)
        return connection
    except Exception as e:
        logger.error(f"Database connection failed: {str(e)}")
        raise

def init_db():
    """Initialize database with required tables"""
    try:
        # First connect without specifying database to create it
        config_without_db = DB_CONFIG.copy()
        database_name = config_without_db.pop('database')
        
        connection = pymysql.connect(**config_without_db)
        cursor = connection.cursor()
        
        # Create database if it doesn't exist
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {database_name}")
        cursor.close()
        connection.close()
        
        # Now connect to the specific database
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Create stops table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS stops (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                latitude DECIMAL(10, 8) NOT NULL,
                longitude DECIMAL(11, 8) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_coords (latitude, longitude)
            )
        """)
        
        # Create optimization_results table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS optimization_results (
                id INT AUTO_INCREMENT PRIMARY KEY,
                route_data JSON NOT NULL,
                total_distance DECIMAL(10, 2) NOT NULL,
                computation_time DECIMAL(8, 4) NOT NULL,
                backend_used VARCHAR(50) NOT NULL,
                optimization_level INT DEFAULT 1,
                stop_count INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_created (created_at),
                INDEX idx_distance (total_distance)
            )
        """)
        
        connection.commit()
        cursor.close()
        connection.close()
        
        logger.info("Database initialized successfully")
        
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}")
        raise