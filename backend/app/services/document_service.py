# backend/app/services/document_service.py
from google.cloud import discoveryengine_v1 as discoveryengine
from app.services.storage_service import StorageService
from app.models.requests import IngestRequest
from app.models.responses import IngestResponse
from app.config import settings
from fastapi import UploadFile
import logging
import json
from typing import List, Dict, Any
import asyncio

logger = logging.getLogger(__name__)

class DocumentService:
    def __init__(self):
        self.storage_service = StorageService()
        self.discovery_client = discoveryengine.DocumentServiceClient()
        
    async def upload_and_process_document(
        self, 
        file: UploadFile, 
        document_type: str = "company"
    ) -> Dict[str, Any]:
        """
        Upload document to storage and create in Vertex AI Search
        """
        try:
            # 1. Upload to Cloud Storage
            file_path, storage_url, metadata = self.storage_service.upload_document(
                file, document_type
            )
            
            # 2. Create document record in Vertex AI Search
            document_id = metadata["unique_id"]
            success = await self._create_vertex_ai_document(
                document_id, file_path, metadata
            )
            
            if success:
                return {
                    "success": True,
                    "document_id": document_id,
                    "file_path": file_path,
                    "storage_url": storage_url,
                    "metadata": metadata,
                    "message": f"Document '{file.filename}' uploaded and processing initiated"
                }
            else:
                # Clean up storage if Vertex AI creation failed
                self.storage_service.delete_document(file_path)
                return {
                    "success": False,
                    "message": "Failed to create document in Vertex AI Search"
                }
                
        except Exception as e:
            logger.error(f"Error in upload_and_process_document: {e}")
            return {
                "success": False,
                "message": f"Upload failed: {str(e)}"
            }
    
    async def _create_vertex_ai_document(
        self, 
        document_id: str, 
        file_path: str, 
        metadata: Dict[str, Any]
    ) -> bool:
        """
        Create document in Vertex AI Search data store
        """
        try:
            # Document data for Vertex AI Search
            document = discoveryengine.Document(
                id=document_id,
                content=discoveryengine.Document.Content(
                    uri=f"gs://{settings.STORAGE_BUCKET_NAME}/{file_path}",
                    mime_type=metadata.get("content_type", "application/pdf")
                ),
                struct_data={
                    "title": metadata["original_filename"],
                    "document_type": metadata["document_type"],
                    "upload_timestamp": metadata["upload_timestamp"],
                    "file_size": int(metadata["file_size"]),
                    "file_path": file_path,
                    "bucket": settings.STORAGE_BUCKET_NAME
                }
            )
            
            # Create document request
            parent = self.discovery_client.branch_path(
                project=settings.PROJECT_ID,
                location=settings.LOCATION,
                data_store=settings.DATA_STORE_ID,
                branch="default_branch"
            )
            
            request = discoveryengine.CreateDocumentRequest(
                parent=parent,
                document=document,
                document_id=document_id
            )
            
            # Create the document (this will trigger indexing)
            operation = self.discovery_client.create_document(request=request)
            logger.info(f"Created Vertex AI document: {document_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error creating Vertex AI document: {e}")
            return False
    
    async def batch_upload_documents(
        self, 
        files: List[UploadFile], 
        document_type: str = "company"
    ) -> Dict[str, Any]:
        """
        Upload multiple documents in batch
        """
        results = []
        successful_uploads = 0
        
        for file in files:
            try:
                result = await self.upload_and_process_document(file, document_type)
                results.append({
                    "filename": file.filename,
                    "result": result
                })
                
                if result["success"]:
                    successful_uploads += 1
                    
            except Exception as e:
                results.append({
                    "filename": file.filename,
                    "result": {
                        "success": False,
                        "message": str(e)
                    }
                })
        
        return {
            "uploads": results,
            "summary": {
                "total_files": len(files),
                "successful_uploads": successful_uploads,
                "failed_uploads": len(files) - successful_uploads
            }
        }
    
    def get_document_status(self, document_id: str) -> Dict[str, Any]:
        """
        Get processing status of a document
        """
        try:
            # Check if document exists in Vertex AI Search
            document_path = self.discovery_client.document_path(
                project=settings.PROJECT_ID,
                location=settings.LOCATION,
                data_store=settings.DATA_STORE_ID,
                branch="default_branch",
                document=document_id
            )
            
            document = self.discovery_client.get_document(name=document_path)
            
            return {
                "exists": True,
                "document_id": document_id,
                "status": "indexed",
                "metadata": dict(document.struct_data) if document.struct_data else {}
            }
            
        except Exception as e:
            logger.error(f"Error getting document status: {e}")
            return {
                "exists": False,
                "document_id": document_id,
                "status": "not_found",
                "error": str(e)
            }
    
    def list_indexed_documents(self) -> List[Dict[str, Any]]:
        """
        List all documents in the Vertex AI Search data store
        """
        try:
            parent = self.discovery_client.branch_path(
                project=settings.PROJECT_ID,
                location=settings.LOCATION,
                data_store=settings.DATA_STORE_ID,
                branch="default_branch"
            )
            
            request = discoveryengine.ListDocumentsRequest(parent=parent)
            page_result = self.discovery_client.list_documents(request=request)
            
            documents = []
            for document in page_result:
                documents.append({
                    "id": document.id,
                    "name": document.name,
                    "content_uri": document.content.uri if document.content else None,
                    "metadata": dict(document.struct_data) if document.struct_data else {}
                })
            
            return documents
            
        except Exception as e:
            logger.error(f"Error listing indexed documents: {e}")
            return []
    
    # Keep existing method for backward compatibility
    def ingest_documents(self, request: IngestRequest) -> IngestResponse:
        """Process document ingestion (backward compatibility)"""
        try:
            num_docs = len(request.documents)
            logger.info(f"Received {num_docs} documents for ingestion via legacy endpoint.")
            
            # For now, just acknowledge - real processing happens via upload endpoint
            return IngestResponse(
                success=True,
                message=f"Acknowledged {num_docs} documents. Use /upload endpoint for real processing."
            )
            
        except Exception as e:
            logger.error(f"Error in legacy ingest: {e}")
            return IngestResponse(
                success=False,
                message=f"Failed to process documents: {str(e)}"
            )