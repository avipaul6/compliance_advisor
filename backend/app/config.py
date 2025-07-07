# backend/app/config.py
import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # Google Cloud Configuration
    PROJECT_ID: str = os.getenv("PROJECT_ID", "your-gcp-project-id")
    LOCATION: str = os.getenv("LOCATION", "global")
    DATA_STORE_ID: str = os.getenv("DATA_STORE_ID", "your-vertex-ai-search-data-store-id")
    
    # Vertex AI Configuration
    VERTEX_AI_LOCATION: str = os.getenv("VERTEX_AI_LOCATION", "us-central1")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    # Environment Detection
    IS_CLOUD_ENVIRONMENT: bool = bool(
        os.getenv("GOOGLE_CLOUD_PROJECT") or 
        os.getenv("CLOUD_RUN_SERVICE") or 
        os.getenv("K_SERVICE") or  # Cloud Run service name
        os.getenv("GAE_APPLICATION")  # App Engine
    )
    
    # API Configuration
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "OFX Compliance Assistant"
    
    # CORS - Allow all origins in Cloud Run for simplicity
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "*"  # Allow all origins in cloud deployment
    ]
    
    # Cloud Run specific settings
    PORT: int = int(os.getenv("PORT", 8080))
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production")
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()