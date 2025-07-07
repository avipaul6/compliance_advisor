import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Google Cloud Configuration
    PROJECT_ID: str = "your-gcp-project-id"
    LOCATION: str = "global"
    DATA_STORE_ID: str = "your-vertex-ai-search-data-store-id"
    
    # Vertex AI Configuration
    VERTEX_AI_LOCATION: str = "us-central1"
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Environment Detection
    IS_CLOUD_ENVIRONMENT: bool = bool(
        os.getenv("GOOGLE_CLOUD_PROJECT") or 
        os.getenv("CLOUD_RUN_SERVICE") or 
        os.getenv("K_SERVICE")  # Cloud Run service name
    )
    
    # API Configuration
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "OFX Compliance Assistant"
    
    # CORS
    BACKEND_CORS_ORIGINS: list = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()