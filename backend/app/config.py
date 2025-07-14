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

    # Cloud Storage Configuration
    STORAGE_BUCKET_NAME: str = os.getenv("STORAGE_BUCKET_NAME", "ofx-compliance-documents")
    
    # Document processing configuration
    DOCUMENT_PROCESSING_FUNCTION_URL: str = os.getenv(
        "DOCUMENT_PROCESSING_FUNCTION_URL", 
        ""
    )
    
    # File upload limits and validation
    MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
    ALLOWED_FILE_EXTENSIONS: List[str] = [".pdf", ".txt", ".docx", ".doc"]
    MAX_BATCH_SIZE: int = int(os.getenv("MAX_BATCH_SIZE", "10"))

    # Environment Detection
    IS_CLOUD_ENVIRONMENT: bool = bool(
        os.getenv("GOOGLE_CLOUD_PROJECT") or 
        os.getenv("CLOUD_RUN_SERVICE") or 
        os.getenv("K_SERVICE") or  # Cloud Run service name
        os.getenv("GAE_APPLICATION")  # App Engine
    )
    
    # backend/app/config.py - Add these lines to your existing config:

    # Vector Search RAG Configuration (add to existing Settings class)
    VECTOR_INDEX_ENDPOINT_ID: str = os.getenv("VECTOR_INDEX_ENDPOINT_ID", "")
    VECTOR_INDEX_ID: str = os.getenv("VECTOR_INDEX_ID", "")
    VECTOR_DEPLOYED_INDEX_ID: str = os.getenv("VECTOR_DEPLOYED_INDEX_ID", "compliance_docs_deployed_small")
    VECTOR_SEARCH_REGION: str = os.getenv("VECTOR_SEARCH_REGION", "us-central1")
    EMBEDDING_DIMENSIONS: int = int(os.getenv("EMBEDDING_DIMENSIONS", "3072"))

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
    
    # Request timeout settings
    REQUEST_TIMEOUT_SECONDS: int = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "300"))
    
    # Logging configuration
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()

# Validation function to ensure required settings are present
def validate_settings():
    """Validate that all required settings are present"""
    required_settings = [
        "PROJECT_ID",
        "DATA_STORE_ID",
        "STORAGE_BUCKET_NAME"
    ]
    
    missing_settings = []
    for setting in required_settings:
        if not getattr(settings, setting) or getattr(settings, setting) == f"your-{setting.lower().replace('_', '-')}":
            missing_settings.append(setting)
    
    if missing_settings:
        raise ValueError(f"Missing required settings: {', '.join(missing_settings)}")
    
    return True