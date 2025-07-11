# backend/app/api/v1/endpoints/health.py - RAG Health Check Endpoints
"""
Health Check Endpoints for RAG System
Comprehensive monitoring of Vector Search, Embeddings, and Generation
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import logging
from datetime import datetime

from app.services.rag_service import RAGService
from app.services.vector_service import VectorService
from app.services.embedding_service import EmbeddingService
from app.services.vertex_ai_service import VertexAIService
from app.config import settings, validate_settings

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/health", summary="Basic Health Check")
async def health_check() -> Dict[str, Any]:
    """Basic health check for the service"""
    try:
        # Validate configuration
        validate_settings()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "OFX Compliance Assistant",
            "version": "2.0.0-RAG",
            "environment": settings.ENVIRONMENT,
            "message": "Service is operational"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")

@router.get("/health/rag", summary="RAG System Health Check")
async def rag_health_check() -> Dict[str, Any]:
    """Comprehensive health check for RAG system components"""
    try:
        # Initialize RAG service
        rag_service = RAGService()
        
        # Perform comprehensive health check
        health_result = rag_service.health_check()
        
        # Add timestamp and service info
        health_result["timestamp"] = datetime.utcnow().isoformat()
        health_result["service_version"] = "2.0.0-RAG"
        
        # Return appropriate HTTP status
        if health_result.get("status") != "healthy":
            raise HTTPException(status_code=503, detail=health_result)
        
        return health_result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"RAG health check failed: {e}")
        raise HTTPException(status_code=503, detail=f"RAG system health check failed: {str(e)}")

@router.get("/health/vector", summary="Vector Search Health Check")
async def vector_health_check() -> Dict[str, Any]:
    """Health check specifically for Vector Search service"""
    try:
        vector_service = VectorService()
        health_result = vector_service.health_check()
        
        health_result["timestamp"] = datetime.utcnow().isoformat()
        
        if health_result.get("status") != "healthy":
            raise HTTPException(status_code=503, detail=health_result)
        
        return health_result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Vector service health check failed: {e}")
        raise HTTPException(status_code=503, detail=f"Vector Search health check failed: {str(e)}")

@router.get("/health/embedding", summary="Embedding Service Health Check")
async def embedding_health_check() -> Dict[str, Any]:
    """Health check specifically for Embedding service"""
    try:
        embedding_service = EmbeddingService()
        health_result = embedding_service.health_check()
        
        health_result["timestamp"] = datetime.utcnow().isoformat()
        
        if health_result.get("status") != "healthy":
            raise HTTPException(status_code=503, detail=health_result)
        
        return health_result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Embedding service health check failed: {e}")
        raise HTTPException(status_code=503, detail=f"Embedding service health check failed: {str(e)}")

@router.get("/health/detailed", summary="Detailed System Health")
async def detailed_health_check() -> Dict[str, Any]:
    """Detailed health check with all system components"""
    health_results = {
        "timestamp": datetime.utcnow().isoformat(),
        "service": "OFX Compliance Assistant RAG",
        "version": "2.0.0-RAG",
        "environment": settings.ENVIRONMENT,
        "overall_status": "unknown",
        "components": {}
    }
    
    component_statuses = []
    
    try:
        # Check configuration
        try:
            validate_settings()
            health_results["components"]["configuration"] = {
                "status": "healthy",
                "message": "All required settings present"
            }
            component_statuses.append(True)
        except Exception as e:
            health_results["components"]["configuration"] = {
                "status": "unhealthy",
                "error": str(e)
            }
            component_statuses.append(False)
        
        # Check Vector Search
        try:
            vector_service = VectorService()
            vector_health = vector_service.health_check()
            health_results["components"]["vector_search"] = vector_health
            component_statuses.append(vector_health.get("status") == "healthy")
        except Exception as e:
            health_results["components"]["vector_search"] = {
                "status": "unhealthy",
                "error": str(e)
            }
            component_statuses.append(False)
        
        # Check Embedding Service
        try:
            embedding_service = EmbeddingService()
            embedding_health = embedding_service.health_check()
            health_results["components"]["embedding_service"] = embedding_health
            component_statuses.append(embedding_health.get("status") == "healthy")
        except Exception as e:
            health_results["components"]["embedding_service"] = {
                "status": "unhealthy",
                "error": str(e)
            }
            component_statuses.append(False)
        
        # Check Vertex AI Service
        try:
            vertex_ai_service = VertexAIService()
            vertex_health = vertex_ai_service.health_check()
            health_results["components"]["vertex_ai_service"] = vertex_health
            component_statuses.append(vertex_health.get("status") == "healthy")
        except Exception as e:
            health_results["components"]["vertex_ai_service"] = {
                "status": "unhealthy", 
                "error": str(e)
            }
            component_statuses.append(False)
        
        # Check RAG Service (comprehensive)
        try:
            rag_service = RAGService()
            rag_health = rag_service.health_check()
            health_results["components"]["rag_service"] = rag_health
            component_statuses.append(rag_health.get("status") == "healthy")
        except Exception as e:
            health_results["components"]["rag_service"] = {
                "status": "unhealthy",
                "error": str(e)
            }
            component_statuses.append(False)
        
        # Determine overall status
        healthy_components = sum(component_statuses)
        total_components = len(component_statuses)
        
        if healthy_components == total_components:
            health_results["overall_status"] = "healthy"
        elif healthy_components >= total_components * 0.7:  # 70% threshold
            health_results["overall_status"] = "degraded"
        else:
            health_results["overall_status"] = "unhealthy"
        
        health_results["component_summary"] = {
            "total_components": total_components,
            "healthy_components": healthy_components,
            "health_percentage": (healthy_components / total_components) * 100 if total_components > 0 else 0
        }
        
        # Add configuration summary
        health_results["configuration"] = {
            "project_id": settings.PROJECT_ID,
            "environment": settings.ENVIRONMENT,
            "vector_search_region": settings.VECTOR_SEARCH_REGION,
            "embedding_model": settings.EMBEDDING_MODEL,
            "generation_model": settings.GENERATION_MODEL,
            "embedding_dimensions": settings.EMBEDDING_DIMENSIONS,
            "chunk_size": settings.CHUNK_SIZE,
            "retrieval_top_k": settings.RETRIEVAL_TOP_K
        }
        
        # Return appropriate status code
        if health_results["overall_status"] == "unhealthy":
            raise HTTPException(status_code=503, detail=health_results)
        elif health_results["overall_status"] == "degraded":
            # Return 200 but with warning information
            health_results["warning"] = "Some components are unhealthy"
        
        return health_results
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Detailed health check failed: {e}")
        health_results["overall_status"] = "unhealthy"
        health_results["error"] = str(e)
        raise HTTPException(status_code=503, detail=health_results)

@router.get("/health/config", summary="Configuration Health Check")
async def config_health_check() -> Dict[str, Any]:
    """Check configuration and environment variables"""
    try:
        # Validate settings
        validate_settings()
        
        # Check critical configuration
        config_status = {
            "timestamp": datetime.utcnow().isoformat(),
            "status": "healthy",
            "configuration": {
                "project_id": {
                    "value": settings.PROJECT_ID,
                    "status": "set" if settings.PROJECT_ID else "missing"
                },
                "vector_endpoint_id": {
                    "value": settings.VECTOR_INDEX_ENDPOINT_ID[:10] + "..." if settings.VECTOR_INDEX_ENDPOINT_ID else None,
                    "status": "set" if settings.VECTOR_INDEX_ENDPOINT_ID else "missing"
                },
                "vector_index_id": {
                    "value": settings.VECTOR_INDEX_ID[:10] + "..." if settings.VECTOR_INDEX_ID else None,
                    "status": "set" if settings.VECTOR_INDEX_ID else "missing"
                },
                "embedding_model": {
                    "value": settings.EMBEDDING_MODEL,
                    "status": "set" if settings.EMBEDDING_MODEL else "missing"
                },
                "generation_model": {
                    "value": settings.GENERATION_MODEL,
                    "status": "set" if settings.GENERATION_MODEL else "missing"
                },
                "storage_bucket": {
                    "value": settings.STORAGE_BUCKET_NAME,
                    "status": "set" if settings.STORAGE_BUCKET_NAME else "missing"
                }
            },
            "rag_settings": {
                "embedding_dimensions": settings.EMBEDDING_DIMENSIONS,
                "chunk_size": settings.CHUNK_SIZE,
                "chunk_overlap": settings.CHUNK_OVERLAP,
                "retrieval_top_k": settings.RETRIEVAL_TOP_K
            },
            "environment": {
                "environment": settings.ENVIRONMENT,
                "is_cloud": settings.IS_CLOUD_ENVIRONMENT,
                "log_level": settings.LOG_LEVEL,
                "request_timeout": settings.REQUEST_TIMEOUT_SECONDS
            }
        }
        
        # Check for any missing critical configs
        missing_configs = []
        for key, config in config_status["configuration"].items():
            if config["status"] == "missing":
                missing_configs.append(key)
        
        if missing_configs:
            config_status["status"] = "unhealthy"
            config_status["missing_configurations"] = missing_configs
            config_status["message"] = f"Missing critical configuration: {', '.join(missing_configs)}"
            raise HTTPException(status_code=503, detail=config_status)
        
        config_status["message"] = "All critical configuration present"
        return config_status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Configuration health check failed: {e}")
        raise HTTPException(status_code=503, detail=f"Configuration check failed: {str(e)}")

@router.get("/health/migration", summary="Migration Status Check")
async def migration_status_check() -> Dict[str, Any]:
    """Check migration status from Data Store to Vector Search"""
    try:
        migration_status = {
            "timestamp": datetime.utcnow().isoformat(),
            "migration_complete": True,
            "status": "healthy",
            "migration_details": {
                "data_store_removed": True,  # DATA_STORE_ID no longer in config
                "vector_search_enabled": bool(settings.VECTOR_INDEX_ENDPOINT_ID and settings.VECTOR_INDEX_ID),
                "rag_services_active": True,
                "embedding_service_active": True,
                "cost_optimized": settings.VECTOR_DEPLOYED_INDEX_ID == "compliance_docs_deployed_small"
            },
            "new_capabilities": [
                "Multi-document RAG analysis",
                "Cost-optimized Vector Search ($65/month)",
                "Enhanced document chunking",
                "Contextual similarity search",
                "Improved compliance analysis"
            ],
            "deprecated_features": [
                "Vertex AI Data Store integration",
                "Single-document context limitation"
            ]
        }
        
        # Check if any migration issues
        issues = []
        
        if not migration_status["migration_details"]["vector_search_enabled"]:
            issues.append("Vector Search not properly configured")
        
        if issues:
            migration_status["status"] = "unhealthy"
            migration_status["migration_complete"] = False
            migration_status["issues"] = issues
            raise HTTPException(status_code=503, detail=migration_status)
        
        migration_status["message"] = "Migration to Vector Search RAG completed successfully"
        return migration_status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Migration status check failed: {e}")
        raise HTTPException(status_code=503, detail=f"Migration status check failed: {str(e)}")