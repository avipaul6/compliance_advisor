# backend/app/api/v1/endpoints/rag.py
"""
RAG Index Management Endpoints
Provides visibility and management of the Vector Search RAG index
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from app.services.rag_index_service import RAGIndexService
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Dependency to get RAG Index Service
def get_rag_index_service() -> RAGIndexService:
    return RAGIndexService()

@router.get("/indexed-documents")
async def list_indexed_documents(
    rag_service: RAGIndexService = Depends(get_rag_index_service)
):
    """List all documents currently indexed in the Vector Search RAG system"""
    try:
        documents = await rag_service.list_indexed_documents()
        
        return {
            "documents": documents,
            "total_count": len(documents),
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Error listing indexed documents: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to list indexed documents: {str(e)}"
        )

@router.get("/index-stats")
async def get_index_statistics(
    rag_service: RAGIndexService = Depends(get_rag_index_service)
):
    """Get statistics about the Vector Search index"""
    try:
        stats = await rag_service.get_index_statistics()
        return stats
        
    except Exception as e:
        logger.error(f"Error getting index statistics: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get index statistics: {str(e)}"
        )

@router.get("/document-status/{document_id}")
async def get_document_index_status(
    document_id: str,
    rag_service: RAGIndexService = Depends(get_rag_index_service)
):
    """Check if a specific document is indexed in the RAG system"""
    try:
        status = await rag_service.check_document_index_status(document_id)
        return status
        
    except Exception as e:
        logger.error(f"Error checking document status: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check document status: {str(e)}"
        )

@router.post("/reindex/{document_id}")
async def reindex_document(
    document_id: str,
    rag_service: RAGIndexService = Depends(get_rag_index_service)
):
    """Trigger reindexing of a specific document"""
    try:
        result = await rag_service.reindex_document(document_id)
        
        if result.get("success"):
            return JSONResponse(content=result, status_code=200)
        else:
            return JSONResponse(content=result, status_code=400)
            
    except Exception as e:
        logger.error(f"Error reindexing document: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reindex document: {str(e)}"
        )

@router.get("/health")
async def check_rag_health(
    rag_service: RAGIndexService = Depends(get_rag_index_service)
):
    """Check the health of the Vector Search RAG deployment"""
    try:
        health = await rag_service.get_vector_search_health()
        
        if health.get("status") == "healthy":
            return health
        else:
            return JSONResponse(content=health, status_code=503)
            
    except Exception as e:
        logger.error(f"RAG health check failed: {e}")
        return JSONResponse(
            content={
                "status": "unhealthy",
                "error": str(e)
            },
            status_code=503
        )

# Update the existing documents.py to use RAG index
@router.get("/sync-status") 
async def get_sync_status(
    rag_service: RAGIndexService = Depends(get_rag_index_service)
):
    """
    Compare storage vs indexed documents to show sync status
    This is a placeholder for future enhancement
    """
    try:
        # Get indexed documents
        indexed_docs = await rag_service.list_indexed_documents()
        
        # For now, just return indexed documents
        # In Phase 2, we'd compare this with storage bucket contents
        return {
            "indexed_count": len(indexed_docs),
            "storage_count": len(indexed_docs),  # Placeholder
            "sync_status": "in_sync",  # Placeholder
            "indexed_documents": indexed_docs,
            "unindexed_documents": [],  # Placeholder for Phase 2
            "last_check": None
        }
        
    except Exception as e:
        logger.error(f"Error getting sync status: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get sync status: {str(e)}"
        )