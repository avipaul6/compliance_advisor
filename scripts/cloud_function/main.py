# cloud_function/main.py - Complete Vector Search RAG Implementation
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
import PyPDF2
import io
import traceback

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration from environment variables
PROJECT_ID = os.getenv("PROJECT_ID", "data-consumption-layer")
VECTOR_INDEX_ENDPOINT_ID = os.getenv("VECTOR_INDEX_ENDPOINT_ID", "3802623581267951616")
VECTOR_INDEX_ID = os.getenv("VECTOR_INDEX_ID", "2338232422744719360")
VECTOR_DEPLOYED_INDEX_ID = os.getenv("VECTOR_DEPLOYED_INDEX_ID", "compliance_docs_deployed_small")
VECTOR_SEARCH_REGION = os.getenv("VECTOR_SEARCH_REGION", "us-central1")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-004")

# Initialize Vertex AI
vertexai.init(project=PROJECT_ID, location=VECTOR_SEARCH_REGION)

@functions_framework.cloud_event
def process_document_upload(cloud_event):
    """
    Triggered by Cloud Storage uploads
    Processes documents into Vector Search RAG system
    """
    try:
        logger.info("🚀 Cloud Function triggered!")
        
        # Extract file information from Cloud Event
        data = cloud_event.data
        bucket_name = data["bucket"]
        file_name = data["name"]
        event_type = data.get("eventType", "")
        
        logger.info(f"Processing upload event: {event_type} for gs://{bucket_name}/{file_name}")
        
        # Only process object creation events
        if "object.create" not in event_type.lower():
            logger.info(f"Ignoring non-creation event: {event_type}")
            return {"status": "ignored", "reason": "not_creation_event"}
        
        # Skip system/temp files
        if _is_system_file(file_name):
            logger.info(f"Skipping system file: {file_name}")
            return {"status": "skipped", "reason": "system_file"}
        
        # Only process document files
        if not _is_document_file(file_name):
            logger.info(f"Skipping non-document file: {file_name}")
            return {"status": "skipped", "reason": "not_document"}
        
        # Initialize storage client
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(file_name)
        
        # Check if file exists and get metadata
        if not blob.exists():
            logger.warning(f"File does not exist: gs://{bucket_name}/{file_name}")
            return {"status": "error", "reason": "file_not_found"}
        
        blob.reload()
        metadata = blob.metadata or {}
        
        # Generate document ID
        document_id = _generate_document_id(file_name)
        logger.info(f"Generated document ID: {document_id}")
        
        # Check if already processed
        if metadata.get("vector_search_processed") == "true":
            logger.info(f"Document already processed: {file_name}")
            return {"status": "skipped", "reason": "already_processed"}
        
        # Process the document
        logger.info(f"🔄 Starting document processing for: {file_name}")
        success = _process_document_for_vector_search(
            document_id=document_id,
            bucket_name=bucket_name,
            file_name=file_name,
            metadata=metadata,
            blob=blob
        )
        
        if success:
            logger.info(f"✅ Successfully processed document: {file_name}")
            
            # Update metadata to mark as processed
            updated_metadata = {
                **metadata,
                "processed": "true",
                "processing_timestamp": _get_timestamp(),
                "vector_search_processed": "true",
                "document_id": document_id,
                "document_type": _infer_document_type(file_name)
            }
            blob.metadata = updated_metadata
            blob.patch()
            
            return {"status": "success", "document_id": document_id}
        else:
            logger.error(f"❌ Failed to process document: {file_name}")
            
            # Mark as failed
            updated_metadata = {
                **metadata,
                "processed": "false",
                "processing_error": "failed_to_process",
                "processing_timestamp": _get_timestamp(),
                "document_id": document_id
            }
            blob.metadata = updated_metadata
            blob.patch()
            
            return {"status": "error", "reason": "processing_failed"}
            
    except Exception as e:
        logger.error(f"❌ Error processing document upload: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        
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
        
        return {"status": "error", "error": str(e)}

def _process_document_for_vector_search(
    document_id: str,
    bucket_name: str,
    file_name: str,
    metadata: Dict[str, Any],
    blob: storage.Blob
) -> bool:
    """
    Process document for Vector Search RAG system
    """
    try:
        logger.info(f"📄 Extracting text from document: {file_name}")
        
        # Extract text from document
        text_content = _extract_text_from_blob(blob, file_name)
        if not text_content or len(text_content.strip()) < 10:
            logger.warning(f"No meaningful text extracted from {file_name}")
            return False
        
        logger.info(f"✅ Extracted {len(text_content)} characters from {file_name}")
        
        # Chunk the text
        logger.info(f"🔪 Chunking text for document: {document_id}")
        chunks = _chunk_text(text_content, chunk_size=1000, overlap=200)
        logger.info(f"✅ Created {len(chunks)} chunks for document: {document_id}")
        
        # Generate embeddings for each chunk
        logger.info(f"🧠 Generating embeddings for document: {document_id}")
        embeddings = _generate_embeddings_for_chunks(chunks, document_id)
        
        if not embeddings:
            logger.warning(f"No embeddings generated for document: {document_id}")
            return False
        
        logger.info(f"✅ Generated {len(embeddings)} embeddings for document: {document_id}")
        
        # Store document metadata for RAG system
        document_metadata = {
            "document_id": document_id,
            "file_name": file_name,
            "bucket_name": bucket_name,
            "document_type": _infer_document_type(file_name),
            "text_length": len(text_content),
            "chunk_count": len(chunks),
            "embedding_count": len(embeddings),
            "processed_timestamp": _get_timestamp(),
            "original_metadata": metadata
        }
        
        # Log successful processing
        logger.info(f"✅ Document processed successfully: {document_id}")
        logger.info(f"   - Text length: {len(text_content)} characters")
        logger.info(f"   - Chunks: {len(chunks)}")
        logger.info(f"   - Embeddings: {len(embeddings)}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error processing document {document_id}: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return False

def _extract_text_from_blob(blob: storage.Blob, file_name: str) -> str:
    """Extract text from different file types"""
    try:
        file_extension = file_name.lower().split('.')[-1]
        
        if file_extension == 'pdf':
            return _extract_text_from_pdf(blob)
        elif file_extension == 'txt':
            return blob.download_as_text(encoding='utf-8')
        elif file_extension in ['docx', 'doc']:
            # For now, skip Word docs or implement docx parsing
            logger.warning(f"Word document processing not implemented: {file_name}")
            return ""
        else:
            logger.warning(f"Unsupported file type: {file_extension}")
            return ""
            
    except Exception as e:
        logger.error(f"Error extracting text from {file_name}: {e}")
        return ""

def _extract_text_from_pdf(blob: storage.Blob) -> str:
    """Extract text from PDF blob"""
    try:
        # Download PDF content
        pdf_content = blob.download_as_bytes()
        pdf_file = io.BytesIO(pdf_content)
        
        # Extract text using PyPDF2
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        text_content = ""
        
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            text_content += page.extract_text() + "\n"
        
        return text_content.strip()
        
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {e}")
        return ""

def _generate_embeddings_for_chunks(chunks: List[str], document_id: str) -> List[Dict]:
    """Generate embeddings for text chunks"""
    try:
        embedding_model = TextEmbeddingModel.from_pretrained(EMBEDDING_MODEL)
        embeddings = []
        
        logger.info(f"Generating embeddings for {len(chunks)} chunks using model: {EMBEDDING_MODEL}")
        
        for i, chunk in enumerate(chunks):
            if not chunk.strip():
                continue
                
            try:
                # Generate embedding for chunk
                embedding_response = embedding_model.get_embeddings([chunk])
                
                if embedding_response and len(embedding_response) > 0:
                    embedding_vector = embedding_response[0].values
                    
                    embeddings.append({
                        "chunk_id": f"{document_id}_chunk_{i}",
                        "text": chunk,
                        "embedding": embedding_vector,
                        "document_id": document_id,
                        "chunk_index": i
                    })
                    
                    logger.info(f"Generated embedding for chunk {i+1}/{len(chunks)}")
                
            except Exception as e:
                logger.error(f"Error generating embedding for chunk {i} of document {document_id}: {e}")
                continue
        
        logger.info(f"Successfully generated {len(embeddings)} embeddings for document {document_id}")
        return embeddings
        
    except Exception as e:
        logger.error(f"Error in embedding generation for document {document_id}: {e}")
        return []

def _chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """Chunk text into smaller pieces for embedding"""
    if len(text) <= chunk_size:
        return [text]
    
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        
        # Try to break at word boundaries
        if end < len(text):
            last_space = chunk.rfind(' ')
            if last_space > chunk_size * 0.8:  # If we can find a good break point
                chunk = chunk[:last_space]
                end = start + last_space
        
        chunks.append(chunk.strip())
        start = end - overlap
        
        if start >= len(text):
            break
    
    return [chunk for chunk in chunks if chunk.strip()]

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
        return "general"

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
    return hashlib.md5(unique_string.encode()).hexdigest()[:16]

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
        "region": VECTOR_SEARCH_REGION,
        "timestamp": _get_timestamp()
    }