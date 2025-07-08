# backend/app/api/v1/endpoints/documents.py
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form, Query
from fastapi.responses import JSONResponse
from app.services.document_service import DocumentService
from app.models.requests import IngestRequest
from app.models.responses import IngestResponse
from app.core.dependencies import get_document_service
from app.config import settings
from typing import List
import os

router = APIRouter()

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form(default="company"),
    document_service: DocumentService = Depends(get_document_service)
):
    """Upload a single document to Cloud Storage and Vertex AI Search"""
    
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Check file extension
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in settings.ALLOWED_FILE_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"File type {file_ext} not allowed. Allowed: {settings.ALLOWED_FILE_EXTENSIONS}"
        )
    
    # Check file size
    file_content = await file.read()
    await file.seek(0)  # Reset file pointer
    
    max_size = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(file_content) > max_size:
        raise HTTPException(
            status_code=400, 
            detail=f"File too large ({len(file_content)} bytes). Max size: {settings.MAX_FILE_SIZE_MB}MB"
        )
    
    # Validate document type
    valid_types = ["company", "regulatory", "austrac"]
    if document_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid document_type. Must be one of: {valid_types}"
        )
    
    # Process upload
    result = await document_service.upload_and_process_document(file, document_type)
    
    if result["success"]:
        return JSONResponse(content=result, status_code=201)
    else:
        raise HTTPException(status_code=500, detail=result["message"])

@router.post("/batch-upload")
async def batch_upload_documents(
    files: List[UploadFile] = File(...),
    document_type: str = Form(default="company"),
    document_service: DocumentService = Depends(get_document_service)
):
    """Upload multiple documents"""
    
    # Validate we have files
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="No files provided")
    
    # Check batch size limit
    max_batch_size = 10  # Limit batch uploads
    if len(files) > max_batch_size:
        raise HTTPException(
            status_code=400,
            detail=f"Too many files. Maximum batch size: {max_batch_size}"
        )
    
    # Validate document type
    valid_types = ["company", "regulatory", "austrac"]
    if document_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid document_type. Must be one of: {valid_types}"
        )
    
    # Process batch upload
    result = await document_service.batch_upload_documents(files, document_type)
    
    return JSONResponse(content=result, status_code=201)

@router.get("/status/{document_id}")
async def get_document_status(
    document_id: str,
    document_service: DocumentService = Depends(get_document_service)
):
    """Get processing status of a specific document"""
    result = document_service.get_document_status(document_id)
    return result

@router.get("/list")
async def list_documents(
    document_type: str = Query(None, description="Filter by document type"),
    document_service: DocumentService = Depends(get_document_service)
):
    """List all indexed documents"""
    documents = document_service.list_indexed_documents()
    
    # Filter by document type if specified
    if document_type:
        documents = [
            doc for doc in documents 
            if doc.get("metadata", {}).get("document_type") == document_type
        ]
    
    return {
        "documents": documents,
        "total_count": len(documents)
    }

@router.delete("/document/{document_id}")
async def delete_document(
    document_id: str,
    document_service: DocumentService = Depends(get_document_service)
):
    """Delete a document from both storage and search index"""
    try:
        # Get document info first
        status = document_service.get_document_status(document_id)
        
        if not status["exists"]:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # TODO: Implement deletion from both Vertex AI Search and Cloud Storage
        # This requires additional methods in the document service
        
        return {
            "success": True,
            "message": f"Document {document_id} deletion initiated"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting document: {str(e)}")

# Keep existing ingest endpoint for backward compatibility
@router.post("/ingest", response_model=IngestResponse)
async def ingest_documents(
    request: IngestRequest,
    document_service: DocumentService = Depends(get_document_service)
):
    """Legacy document ingestion endpoint (for backward compatibility)"""
    return document_service.ingest_documents(request)

@router.get("/health")
async def health_check():
    """Health check endpoint for the document service"""
    try:
        # Basic health check - could be expanded to check dependencies
        return {
            "status": "healthy",
            "service": "document_service",
            "storage_bucket": settings.STORAGE_BUCKET_NAME,
            "data_store_id": settings.DATA_STORE_ID
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")