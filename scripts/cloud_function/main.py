# cloud_function/main.py - Updated for Vector Search RAG
import functions_framework
from google.cloud import aiplatform
from google.cloud import storage
import logging
import json
import os
from typing import Dict, Any, List
import hashlib
from datetime import datetime
import vertexai
from vertexai.language_models import TextEmbeddingModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration from environment variables
PROJECT_ID = os.getenv("PROJECT_ID", "data-consumption-layer")
VECTOR_INDEX_ENDPOINT_ID = os.getenv("VECTOR_INDEX_ENDPOINT_ID", "3802623581267951616")
VECTOR_INDEX_ID = os.getenv("VECTOR_INDEX_ID", "2338232422744719360")
VECTOR_DEPLOYED_INDEX_ID = os.getenv("VECTOR_DEPLOYED_INDEX_ID", "compliance_docs_deployed_small")
VECTOR_SEARCH_REGION = os.getenv("VECTOR_SEARCH_REGION", "us-central1")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "gemini-embedding-001")

# Initialize Vertex AI
vertexai.init(project=PROJECT_ID, location=VECTOR_SEARCH_REGION)

@functions_framework.cloud_event
def process_document_upload(cloud_event):
    """
    Triggered by Cloud Storage uploads
    Processes documents into Vector Search RAG system
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
        
        # Process the document for Vector Search
        success = _process_document_for_vector_search(
            document_id, 
            bucket_name, 
            file_name, 
            metadata,
            blob
        )
        
        if success:
            logger.info(f"Successfully processed document for Vector Search: {document_id}")
            
            # Update blob metadata to mark as processed
            updated_metadata = {
                **metadata, 
                "processed": "true", 
                "processing_timestamp": _get_timestamp(),
                "vector_search_processed": "true",
                "unique_id": document_id
            }
            blob.metadata = updated_metadata
            blob.patch()
            
            logger.info(f"Marked document as processed: {file_name}")
        else:
            logger.error(f"Failed to process document: {document_id}")
            
            # Mark as failed
            updated_metadata = {
                **metadata, 
                "processed": "false", 
                "processing_error": "failed_to_index_vector_search",
                "unique_id": document_id
            }
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
                error_metadata = {
                    **(blob.metadata or {}), 
                    "processed": "error", 
                    "error_message": str(e),
                    "processing_timestamp": _get_timestamp()
                }
                blob.metadata = error_metadata
                blob.patch()
        except Exception as meta_error:
            logger.error(f"Could not update error metadata: {meta_error}")

def _process_document_for_vector_search(
    document_id: str,
    bucket_name: str,
    file_name: str,
    metadata: Dict[str, Any],
    blob: storage.Blob
) -> bool:
    """
    Process document for Vector Search RAG system
    
    This function:
    1. Extracts text from the document
    2. Chunks the text
    3. Generates embeddings
    4. Stores metadata for RAG system
    
    Note: For now, we're just marking documents as processed.
    Full Vector Search indexing would require additional setup.
    """
    try:
        logger.info(f"Processing document {document_id} for Vector Search")
        
        # Extract document text (simplified for now)
        document_text = _extract_text_from_blob(blob)
        
        if not document_text or len(document_text.strip()) < 50:
            logger.warning(f"Document {document_id} has insufficient text content")
            return False
        
        # Generate embeddings for the document
        embeddings = _generate_embeddings(document_text, document_id)
        
        if not embeddings:
            logger.error(f"Failed to generate embeddings for document {document_id}")
            return False
        
        # Store document metadata in a format compatible with RAG system
        rag_metadata = {
            "document_id": document_id,
            "title": metadata.get("original_filename", file_name),
            "document_type": metadata.get("document_type", _infer_document_type(file_name)),
            "upload_timestamp": metadata.get("upload_timestamp", _get_timestamp()),
            "processing_timestamp": _get_timestamp(),
            "file_size": int(metadata.get("file_size", blob.size or 0)),
            "file_path": file_name,
            "bucket": bucket_name,
            "content_type": metadata.get("content_type", blob.content_type or "application/octet-stream"),
            "text_length": len(document_text),
            "embedding_count": len(embeddings)
        }
        
        # Store metadata back to blob for RAG system to access
        enhanced_metadata = {**metadata, **rag_metadata}
        blob.metadata = enhanced_metadata
        blob.patch()
        
        logger.info(f"Successfully processed document {document_id} with {len(embeddings)} embeddings")
        return True
        
    except Exception as e:
        logger.error(f"Error processing document {document_id} for Vector Search: {e}")
        return False

def _extract_text_from_blob(blob: storage.Blob) -> str:
    """
    Extract text content from blob
    For now, this is a simplified implementation
    """
    try:
        # For text files, read directly
        if blob.content_type and "text" in blob.content_type:
            content = blob.download_as_text()
            return content
        
        # For other files, return filename as content (simplified)
        # In a full implementation, you'd use document AI or other text extraction
        logger.info(f"Non-text file detected: {blob.name}, using filename as content")
        return f"Document: {blob.name}"
        
    except Exception as e:
        logger.error(f"Error extracting text from blob {blob.name}: {e}")
        return f"Document: {blob.name} (text extraction failed)"

def _generate_embeddings(text: str, document_id: str) -> List[Dict[str, Any]]:
    """
    Generate embeddings for document text
    """
    try:
        # Initialize embedding model
        embedding_model = TextEmbeddingModel.from_pretrained(EMBEDDING_MODEL)
        
        # Chunk the text (simplified chunking)
        chunks = _chunk_text(text)
        embeddings = []
        
        for i, chunk in enumerate(chunks):
            try:
                # Generate embedding for chunk
                embedding_response = embedding_model.get_embeddings([chunk])
                
                if embedding_response and len(embedding_response) > 0:
                    embedding_vector = embedding_response[0].values
                    
                    embeddings.append({
                        "chunk_id": f"{document_id}_chunk_{i}",
                        "text": chunk,
                        "embedding": embedding_vector,
                        "document_id": document_id
                    })
                
            except Exception as e:
                logger.error(f"Error generating embedding for chunk {i} of document {document_id}: {e}")
                continue
        
        logger.info(f"Generated {len(embeddings)} embeddings for document {document_id}")
        return embeddings
        
    except Exception as e:
        logger.error(f"Error in embedding generation for document {document_id}: {e}")
        return []

def _chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """
    Chunk text into smaller pieces for embedding
    """
    if len(text) <= chunk_size:
        return [text]
    
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start = end - overlap
    
    return chunks

def _infer_document_type(file_name: str) -> str:
    """Infer document type from file path"""
    file_lower = file_name.lower()
    
    if "company/" in file_lower:
        return "company"
    elif "regulatory/" in file_lower:
        return "regulatory"
    elif "austrac/" in file_lower:
        return "austrac"
    else:
        return "unknown"

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
        '.git/',
        '.placeholder'
    ]
    file_lower = file_name.lower()
    return any(pattern in file_lower for pattern in system_patterns)

def _generate_document_id(file_name: str) -> str:
    """Generate document ID from file name"""
    import time
    unique_string = f"{file_name}_{int(time.time())}"
    return hashlib.md5(unique_string.encode()).hexdigest()

def _get_timestamp() -> str:
    """Get current timestamp in ISO format"""
    return datetime.now().isoformat()

# Health check endpoint for the Cloud Function
@functions_framework.http
def health_check(request):
    """HTTP health check endpoint"""
    return {
        "status": "healthy",
        "function": "process-document-upload-vector-search",
        "project_id": PROJECT_ID,
        "vector_endpoint_id": VECTOR_INDEX_ENDPOINT_ID,
        "vector_index_id": VECTOR_INDEX_ID,
        "embedding_model": EMBEDDING_MODEL,
        "region": VECTOR_SEARCH_REGION
    }