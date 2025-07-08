# backend/app/services/storage_service.py
from google.cloud import storage
from google.cloud.storage import Blob
from fastapi import UploadFile
from app.config import settings
import logging
import uuid
from datetime import datetime
from typing import Tuple, Optional
import mimetypes

logger = logging.getLogger(__name__)

class StorageService:
    def __init__(self):
        self.client = storage.Client(project=settings.PROJECT_ID)
        self.bucket_name = settings.STORAGE_BUCKET_NAME
        
    def upload_document(
        self, 
        file: UploadFile, 
        document_type: str = "company"
    ) -> Tuple[str, str, dict]:
        """
        Upload document to Cloud Storage
        Returns: (file_path, download_url, metadata)
        """
        try:
            # Generate unique file path
            file_extension = self._get_file_extension(file.filename)
            unique_id = str(uuid.uuid4())
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            
            file_path = f"{document_type}/{timestamp}_{unique_id}_{file.filename}"
            
            # Get bucket
            bucket = self.client.bucket(self.bucket_name)
            blob = bucket.blob(file_path)
            
            # Read file content and get size
            file_content = file.file.read()
            file_size = len(file_content)
            
            # Prepare metadata
            metadata = {
                "original_filename": file.filename,
                "content_type": file.content_type,
                "document_type": document_type,
                "upload_timestamp": datetime.now().isoformat(),
                "file_size": str(file_size),
                "unique_id": unique_id
            }
            
            # Reset file pointer and upload
            file.file.seek(0)
            
            # Upload with metadata
            blob.metadata = metadata
            blob.upload_from_file(file.file, content_type=file.content_type)
            
            logger.info(f"Uploaded document to: gs://{self.bucket_name}/{file_path}")
            
            return file_path, f"gs://{self.bucket_name}/{file_path}", metadata
            
        except Exception as e:
            logger.error(f"Error uploading document: {e}")
            raise
    
    def _get_file_extension(self, filename: str) -> str:
        """Extract file extension"""
        if not filename:
            return ""
        return "." + filename.split(".")[-1].lower() if "." in filename else ""
    
    def delete_document(self, file_path: str) -> bool:
        """Delete document from Cloud Storage"""
        try:
            bucket = self.client.bucket(self.bucket_name)
            blob = bucket.blob(file_path)
            blob.delete()
            logger.info(f"Deleted document: {file_path}")
            return True
        except Exception as e:
            logger.error(f"Error deleting document: {e}")
            return False
    
    def get_document_metadata(self, file_path: str) -> Optional[dict]:
        """Get document metadata from Cloud Storage"""
        try:
            bucket = self.client.bucket(self.bucket_name)
            blob = bucket.blob(file_path)
            
            if blob.exists():
                blob.reload()
                return blob.metadata
            return None
            
        except Exception as e:
            logger.error(f"Error getting document metadata: {e}")
            return None
    
    def list_documents(self, document_type: str = None) -> list:
        """List documents in bucket"""
        try:
            bucket = self.client.bucket(self.bucket_name)
            
            prefix = f"{document_type}/" if document_type else ""
            blobs = bucket.list_blobs(prefix=prefix)
            
            documents = []
            for blob in blobs:
                documents.append({
                    "name": blob.name,
                    "size": blob.size,
                    "created": blob.time_created,
                    "updated": blob.updated,
                    "metadata": blob.metadata or {}
                })
            
            return documents
            
        except Exception as e:
            logger.error(f"Error listing documents: {e}")
            return []