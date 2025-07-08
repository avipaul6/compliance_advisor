# cloud_function/main.py
import functions_framework
from google.cloud import discoveryengine_v1 as discoveryengine
from google.cloud import storage
import logging
import json
import os
from typing import Dict, Any
import hashlib

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration from environment variables
PROJECT_ID = os.getenv("PROJECT_ID", "your-gcp-project-id")
DATA_STORE_ID = os.getenv("DATA_STORE_ID", "your-vertex-ai-search-data-store-id")
LOCATION = os.getenv("LOCATION", "global")

@functions_framework.cloud_event
def process_document_upload(cloud_event):
    """
    Triggered by Cloud Storage uploads
    Processes documents into Vertex AI Search
    """
    try:
        # Extract file information from Cloud Event
        data = cloud_event.data
        bucket_name = data["bucket"]
        file_name = data["name"]
        event_type = data.get("eventType", "")
        
        logger.info(f"Processing upload event: {event_type} for gs://{bucket_name}/{file_name}")
        
        # Only process object creation events
        if "object.create" not in event_type.lower():
            logger.info(f"Ignoring non-creation event: {event_type}")
            return
        
        # Skip if not a document file
        if not _is_document_file(file_name):
            logger.info(f"Skipping non-document file: {file_name}")
            return
        
        # Skip temporary or system files
        if _is_system_file(file_name):
            logger.info(f"Skipping system file: {file_name}")
            return
        
        # Initialize clients
        storage_client = storage.Client()
        discovery_client = discoveryengine.DocumentServiceClient()
        
        # Get file metadata
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(file_name)
        
        if not blob.exists():
            logger.error(f"File not found: {file_name}")
            return
        
        # Reload to get latest metadata
        blob.reload()
        metadata = blob.metadata or {}
        
        # Check if already processed
        if metadata.get("processed") == "true":
            logger.info(f"Document already processed: {file_name}")
            return
        
        # Extract or generate document ID
        document_id = metadata.get("unique_id")
        if not document_id:
            document_id = _generate_document_id(file_name)
            logger.info(f"Generated document ID: {document_id}")
        
        # Process the document
        success = _create_or_update_vertex_document(
            discovery_client, 
            document_id, 
            bucket_name, 
            file_name, 
            metadata,
            blob
        )
        
        if success:
            logger.info(f"Successfully processed document: {document_id}")
            
            # Update blob metadata to mark as processed
            updated_metadata = {**metadata, "processed": "true", "processing_timestamp": _get_timestamp()}
            blob.metadata = updated_metadata
            blob.patch()
            
            logger.info(f"Marked document as processed: {file_name}")
        else:
            logger.error(f"Failed to process document: {document_id}")
            
            # Mark as failed
            updated_metadata = {**metadata, "processed": "false", "processing_error": "failed_to_index"}
            blob.metadata = updated_metadata
            blob.patch()
            
    except Exception as e:
        logger.error(f"Error processing document upload: {e}")
        
        # Try to mark the file as having an error
        try:
            bucket = storage.Client().bucket(bucket_name)
            blob = bucket.blob(file_name)
            if blob.exists():
                blob.reload()
                error_metadata = {**(blob.metadata or {}), "processed": "error", "error_message": str(e)}
                blob.metadata = error_metadata
                blob.patch()
        except Exception as meta_error:
            logger.error(f"Could not update error metadata: {meta_error}")

def _is_document_file(file_name: str) -> bool:
    """Check if file is a document we should process"""
    allowed_extensions = ['.pdf', '.txt', '.docx', '.doc']
    file_lower = file_name.lower()
    return any(file_lower.endswith(ext) for ext in allowed_extensions)

def _is_system_file(file_name: str) -> bool:
    """Check if file is a system/temporary file to skip"""
    system_patterns = [
        '~$',  # Office temp files
        '.tmp',
        '.temp',
        'thumbs.db',
        '.ds_store',
        '__pycache__',
        '.git/'
    ]
    file_lower = file_name.lower()
    return any(pattern in file_lower for pattern in system_patterns)

def _generate_document_id(file_name: str) -> str:
    """Generate document ID from file name"""
    # Use a combination of filename and timestamp for uniqueness
    import time
    unique_string = f"{file_name}_{int(time.time())}"
    return hashlib.md5(unique_string.encode()).hexdigest()

def _get_timestamp() -> str:
    """Get current timestamp in ISO format"""
    from datetime import datetime
    return datetime.now().isoformat()

def _create_or_update_vertex_document(
    client: discoveryengine.DocumentServiceClient,
    document_id: str,
    bucket_name: str,
    file_name: str,
    metadata: Dict[str, Any],
    blob: storage.Blob
) -> bool:
    """Create or update document in Vertex AI Search"""
    try:
        # Enhanced document metadata
        struct_data = {
            "title": metadata.get("original_filename", file_name),
            "document_type": metadata.get("document_type", "unknown"),
            "upload_timestamp": metadata.get("upload_timestamp", _get_timestamp()),
            "file_size": metadata.get("file_size", str(blob.size or 0)),
            "file_path": file_name,
            "bucket": bucket_name,
            "processing_timestamp": _get_timestamp(),
            "content_type": metadata.get("content_type", blob.content_type or "application/octet-stream")
        }
        
        # Create document object
        document = discoveryengine.Document(
            id=document_id,
            content=discoveryengine.Document.Content(
                uri=f"gs://{bucket_name}/{file_name}",
                mime_type=struct_data["content_type"]
            ),
            struct_data=struct_data
        )
        
        # Get parent path
        parent = client.branch_path(
            project=PROJECT_ID,
            location=LOCATION,
            data_store=DATA_STORE_ID,
            branch="default_branch"
        )
        
        # Try to create the document first
        try:
            request = discoveryengine.CreateDocumentRequest(
                parent=parent,
                document=document,
                document_id=document_id
            )
            
            operation = client.create_document(request=request)
            logger.info(f"Created new document in Vertex AI Search: {document_id}")
            return True
            
        except Exception as create_error:
            create_error_str = str(create_error).lower()
            
            # If document already exists, try to update it
            if "already exists" in create_error_str or "duplicate" in create_error_str:
                try:
                    document_path = client.document_path(
                        project=PROJECT_ID,
                        location=LOCATION,
                        data_store=DATA_STORE_ID,
                        branch="default_branch",
                        document=document_id
                    )
                    
                    # Set the document name for update
                    document.name = document_path
                    
                    update_request = discoveryengine.UpdateDocumentRequest(
                        document=document
                    )
                    
                    operation = client.update_document(request=update_request)
                    logger.info(f"Updated existing document in Vertex AI Search: {document_id}")
                    return True
                    
                except Exception as update_error:
                    logger.error(f"Error updating document {document_id}: {update_error}")
                    return False
            else:
                logger.error(f"Error creating document {document_id}: {create_error}")
                return False
                
    except Exception as e:
        logger.error(f"Error in _create_or_update_vertex_document: {e}")
        return False

# Health check endpoint for the Cloud Function
@functions_framework.http
def health_check(request):
    """HTTP health check endpoint"""
    return {
        "status": "healthy",
        "function": "process-document-upload",
        "project_id": PROJECT_ID,
        "data_store_id": DATA_STORE_ID,
        "location": LOCATION
    }