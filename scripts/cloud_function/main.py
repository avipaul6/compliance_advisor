# cloud_function/main.py - MINIMAL WORKING Vector Search Implementation
import functions_framework
from google.cloud import aiplatform
from google.cloud import storage
import logging
import os
import io
import PyPDF2
import hashlib
from datetime import datetime
from typing import Dict, Any, List
import vertexai
from vertexai.language_models import TextEmbeddingModel
from cloudevents.http import CloudEvent

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
PROJECT_ID = os.getenv("PROJECT_ID", "data-consumption-layer")
VECTOR_INDEX_ENDPOINT_ID = os.getenv("VECTOR_INDEX_ENDPOINT_ID", "3802623581267951616")
VECTOR_INDEX_ID = os.getenv("VECTOR_INDEX_ID", "6438056196023779328")
VECTOR_DEPLOYED_INDEX_ID = os.getenv("VECTOR_DEPLOYED_INDEX_ID", "compliance_docs_streaming")
VECTOR_SEARCH_REGION = os.getenv("VECTOR_SEARCH_REGION", "us-central1")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "gemini-embedding-001")

# Initialize Vertex AI
vertexai.init(project=PROJECT_ID, location=VECTOR_SEARCH_REGION)

@functions_framework.cloud_event
def process_document_upload(cloud_event):
    """
    Process uploaded PDF/documents into Vector Search RAG index
    """
    try:
        logger.info("🚀 PDF to RAG processing started")
        
        # Extract file info from CloudEvent data
        data = cloud_event.data
        bucket_name = data["bucket"]
        file_name = data["name"]
        event_type = cloud_event['type']
        
        logger.info(f"📁 Processing: gs://{bucket_name}/{file_name}")
        
        # Only process creation/finalized events  
        if "finalized" not in event_type and "create" not in event_type:
            logger.info(f"⏭️ Skipping {event_type}")
            return {"status": "skipped", "reason": "not_creation"}
        
        # Skip system files and only process documents
        if _is_system_file(file_name) or not _is_document_file(file_name):
            logger.info(f"⏭️ Skipping: {file_name}")
            return {"status": "skipped", "reason": "not_document"}
        
        # Initialize storage and check if already processed
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(file_name)
        
        if not blob.exists():
            logger.error(f"❌ File not found: {file_name}")
            return {"status": "error", "reason": "file_not_found"}
        
        blob.reload()
        metadata = blob.metadata or {}
        
        if metadata.get("rag_processed") == "true":
            logger.info(f"⏭️ Already processed: {file_name}")
            return {"status": "skipped", "reason": "already_processed"}
        
        # STEP 1: Extract text from PDF
        extracted_text = _extract_text_from_pdf(blob)
        if not extracted_text or len(extracted_text.strip()) < 50:
            logger.error(f"❌ Failed to extract meaningful text from: {file_name}")
            return {"status": "error", "reason": "text_extraction_failed"}
        
        logger.info(f"✅ Extracted {len(extracted_text)} characters from PDF")
        
        # STEP 2: Chunk text
        chunks = _chunk_text(extracted_text, chunk_size=1000, overlap=200)
        logger.info(f"✅ Created {len(chunks)} text chunks")
        
        # STEP 3: Generate embeddings and upsert to Vector Search
        success = _process_chunks_to_vector_search(chunks, file_name)
        if not success:
            logger.error(f"❌ Failed to process chunks to Vector Search: {file_name}")
            return {"status": "error", "reason": "vector_processing_failed"}
        
        # STEP 4: Update metadata
        document_id = _generate_document_id(file_name)
        updated_metadata = {
            **metadata,
            "rag_processed": "true",
            "document_id": document_id,
            "processing_timestamp": datetime.now().isoformat(),
            "text_length": len(extracted_text),
            "chunk_count": len(chunks),
            "vector_search_indexed": "true"
        }
        blob.metadata = updated_metadata
        blob.patch()
        
        logger.info(f"🎉 RAG processing complete for: {file_name}")
        return {
            "status": "success", 
            "document_id": document_id,
            "chunks": len(chunks)
        }
        
    except Exception as e:
        logger.error(f"❌ RAG processing error: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {"status": "error", "error": str(e)}

def _extract_text_from_pdf(blob: storage.Blob) -> str:
    """Extract text from PDF blob"""
    try:
        logger.info("📄 Extracting text from PDF...")
        
        # Download PDF content
        pdf_content = blob.download_as_bytes()
        pdf_file = io.BytesIO(pdf_content)
        
        # Extract text using PyPDF2
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        text_content = ""
        
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            page_text = page.extract_text()
            text_content += page_text + "\n"
        
        logger.info(f"✅ PDF text extraction complete: {len(text_content)} characters")
        return text_content.strip()
        
    except Exception as e:
        logger.error(f"❌ PDF text extraction failed: {e}")
        return ""

def _chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """Chunk text into overlapping pieces"""
    if len(text) <= chunk_size:
        return [text]
    
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        
        # Try to break at sentence or word boundaries
        if end < len(text):
            last_period = chunk.rfind('. ')
            last_newline = chunk.rfind('\n')
            last_space = chunk.rfind(' ')
            
            break_point = max(last_period, last_newline, last_space)
            if break_point > chunk_size * 0.7:
                chunk = chunk[:break_point + 1]
                end = start + break_point + 1
        
        chunks.append(chunk.strip())
        start = end - overlap
        
        if start >= len(text):
            break
    
    return [chunk for chunk in chunks if chunk.strip()]

def _process_chunks_to_vector_search(chunks: List[str], file_name: str) -> bool:
    """
    Process text chunks to Vector Search using minimal approach
    """
    try:
        logger.info(f"🧠 Processing {len(chunks)} chunks to Vector Search...")
        
        # Initialize embedding model
        embedding_model = TextEmbeddingModel.from_pretrained(EMBEDDING_MODEL)
        
        # Get the Vector Search index object
        my_index = aiplatform.MatchingEngineIndex(
            index_name=VECTOR_INDEX_ID,
            project=PROJECT_ID,
            location=VECTOR_SEARCH_REGION
        )
        
        # Process chunks in batches
        batch_size = 50  # Conservative batch size
        datapoints = []
        
        for i, chunk in enumerate(chunks):
            if not chunk.strip():
                continue
                
            try:
                # Generate embedding
                response = embedding_model.get_embeddings([chunk])
                if response and len(response) > 0:
                    embedding_vector = response[0].values
                    
                    # Create minimal datapoint - NO RESTRICTS to avoid format issues
                    datapoint = {
                        "datapoint_id": f"{_generate_document_id(file_name)}_chunk_{i}",
                        "feature_vector": embedding_vector
                    }
                    
                    datapoints.append(datapoint)
                    
                    # Process in batches
                    if len(datapoints) >= batch_size:
                        success = _upsert_datapoints_batch(my_index, datapoints)
                        if not success:
                            logger.error(f"Failed to upsert batch at chunk {i}")
                            return False
                        datapoints = []
                        logger.info(f"✅ Upserted batch ending at chunk {i}")
                
            except Exception as e:
                logger.error(f"Error processing chunk {i}: {e}")
                continue
        
        # Process remaining datapoints
        if datapoints:
            success = _upsert_datapoints_batch(my_index, datapoints)
            if not success:
                logger.error(f"Failed to upsert final batch")
                return False
            logger.info(f"✅ Upserted final batch of {len(datapoints)} datapoints")
        
        logger.info(f"✅ Successfully processed all chunks to Vector Search")
        return True
        
    except Exception as e:
        logger.error(f"❌ Vector Search processing failed: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return False

def _upsert_datapoints_batch(index: aiplatform.MatchingEngineIndex, datapoints: List[Dict]) -> bool:
    """
    Upsert a batch of datapoints using the Vector Search method
    """
    try:
        logger.info(f"📤 Upserting {len(datapoints)} datapoints to Vector Search...")
        
        # Use the official upsert_datapoints method
        index.upsert_datapoints(datapoints=datapoints)
        
        logger.info(f"✅ Successfully upserted {len(datapoints)} datapoints")
        return True
        
    except Exception as e:
        logger.error(f"❌ Upsert failed: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return False

def _generate_document_id(file_name: str) -> str:
    """Generate unique document ID"""
    import time
    unique_string = f"{file_name}_{int(time.time())}"
    return hashlib.md5(unique_string.encode()).hexdigest()[:16]

def _is_document_file(file_name: str) -> bool:
    """Check if file is a document we should process"""
    allowed_extensions = ['.pdf', '.txt', '.docx', '.doc']
    return any(file_name.lower().endswith(ext) for ext in allowed_extensions)

def _is_system_file(file_name: str) -> bool:
    """Check if file is a system/temporary file to skip"""
    system_patterns = ['~$', '.tmp', '.temp', 'thumbs.db', '.ds_store', '__pycache__', '.git/', '.placeholder']
    file_lower = file_name.lower()
    return any(pattern in file_lower for pattern in system_patterns)