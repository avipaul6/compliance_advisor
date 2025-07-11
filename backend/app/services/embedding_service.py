"""
Embedding Service - Text to Vector Conversion
Handles document chunking and embedding generation using Vertex AI Gemini embeddings
"""
import logging
from typing import List, Dict, Any, Optional
import re
from google.cloud import aiplatform
from vertexai.language_models import TextEmbeddingModel
import hashlib
import json

from app.config import settings

logger = logging.getLogger(__name__)

class EmbeddingService:
    """Service for generating embeddings from text content"""
    
    def __init__(self):
        """Initialize the embedding service"""
        self.project_id = settings.PROJECT_ID
        self.region = settings.VERTEX_AI_LOCATION
        self.model_name = settings.EMBEDDING_MODEL
        self.chunk_size = settings.CHUNK_SIZE
        self.chunk_overlap = settings.CHUNK_OVERLAP
        self.embedding_dimensions = settings.EMBEDDING_DIMENSIONS
        
        # Initialize Vertex AI
        aiplatform.init(
            project=self.project_id,
            location=self.region
        )
        
        self._model = None
        self._initialize_model()
    
    def _initialize_model(self):
        """Initialize the Gemini embedding model"""
        try:
            self._model = TextEmbeddingModel.from_pretrained(self.model_name)
            logger.info(f"Initialized embedding model: {self.model_name}")
        except Exception as e:
            logger.error(f"Failed to initialize embedding model: {e}")
            raise
    
    def chunk_document(self, text: str, document_id: str, metadata: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Split document text into overlapping chunks for embedding
        
        Args:
            text: The document text to chunk
            document_id: Unique identifier for the document
            metadata: Additional metadata to include with each chunk
            
        Returns:
            List of document chunks with metadata
        """
        if not text or not text.strip():
            logger.warning(f"Empty text provided for document {document_id}")
            return []
        
        # Clean and normalize text
        cleaned_text = self._clean_text(text)
        
        # Split into chunks
        chunks = self._split_text_into_chunks(cleaned_text)
        
        # Create chunk objects with metadata
        chunk_objects = []
        for i, chunk_text in enumerate(chunks):
            chunk_id = self._generate_chunk_id(document_id, i, chunk_text)
            
            chunk_obj = {
                "id": chunk_id,
                "document_id": document_id,
                "chunk_index": i,
                "text": chunk_text,
                "metadata": {
                    "document_id": document_id,
                    "chunk_index": i,
                    "total_chunks": len(chunks),
                    "character_count": len(chunk_text),
                    "word_count": len(chunk_text.split()),
                    **(metadata or {})
                }
            }
            chunk_objects.append(chunk_obj)
        
        logger.info(f"Created {len(chunk_objects)} chunks for document {document_id}")
        return chunk_objects
    
    def _clean_text(self, text: str) -> str:
        """Clean and normalize text for processing"""
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove special characters that might interfere with embeddings
        text = re.sub(r'[^\w\s\.\,\;\:\!\?\-\(\)\"\'\/]', '', text)
        
        # Normalize quotes
        text = text.replace('"', '"').replace('"', '"')
        text = text.replace(''', "'").replace(''', "'")
        
        return text.strip()
    
    def _split_text_into_chunks(self, text: str) -> List[str]:
        """Split text into overlapping chunks based on configuration"""
        if len(text) <= self.chunk_size:
            return [text]
        
        chunks = []
        start = 0
        
        while start < len(text):
            # Calculate end position
            end = start + self.chunk_size
            
            # If this isn't the last chunk, try to break at sentence boundaries
            if end < len(text):
                # Look for sentence boundaries within the last 100 characters
                sentence_end = max(
                    text.rfind('.', start, end),
                    text.rfind('!', start, end),
                    text.rfind('?', start, end)
                )
                
                if sentence_end > start + self.chunk_size // 2:
                    end = sentence_end + 1
                else:
                    # Fall back to word boundaries
                    word_end = text.rfind(' ', start, end)
                    if word_end > start + self.chunk_size // 2:
                        end = word_end
            
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            # Move start position with overlap
            start = end - self.chunk_overlap
            
            # Prevent infinite loop
            if start >= len(text):
                break
        
        return chunks
    
    def _generate_chunk_id(self, document_id: str, chunk_index: int, chunk_text: str) -> str:
        """Generate a unique ID for a chunk"""
        # Create a hash of the chunk content for uniqueness
        content_hash = hashlib.md5(chunk_text.encode()).hexdigest()[:8]
        return f"{document_id}_chunk_{chunk_index:03d}_{content_hash}"
    
    def generate_embedding(self, text: str) -> Optional[List[float]]:
        """
        Generate embedding for a single text
        
        Args:
            text: Text to embed
            
        Returns:
            Embedding vector or None if failed
        """
        if not self._model:
            logger.error("Embedding model not initialized")
            return None
        
        try:
            # Ensure text is not too long for the model
            if len(text) > 8000:  # Gemini embedding model limit
                text = text[:8000]
                logger.warning("Text truncated to fit embedding model limits")
            
            embeddings = self._model.get_embeddings([text])
            
            if embeddings and len(embeddings) > 0:
                return embeddings[0].values
            else:
                logger.error("No embeddings returned from model")
                return None
                
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            return None
    
    def generate_embeddings_batch(self, texts: List[str]) -> List[Optional[List[float]]]:
        """
        Generate embeddings for multiple texts in batch
        
        Args:
            texts: List of texts to embed
            
        Returns:
            List of embedding vectors (None for failed embeddings)
        """
        if not self._model:
            logger.error("Embedding model not initialized")
            return [None] * len(texts)
        
        try:
            # Process in batches to avoid API limits
            batch_size = 5  # Conservative batch size for Gemini
            all_embeddings = []
            
            for i in range(0, len(texts), batch_size):
                batch_texts = texts[i:i + batch_size]
                
                # Truncate texts that are too long
                truncated_texts = []
                for text in batch_texts:
                    if len(text) > 8000:
                        truncated_texts.append(text[:8000])
                        logger.warning("Text truncated to fit embedding model limits")
                    else:
                        truncated_texts.append(text)
                
                try:
                    embeddings = self._model.get_embeddings(truncated_texts)
                    batch_embeddings = [emb.values if emb else None for emb in embeddings]
                    all_embeddings.extend(batch_embeddings)
                    
                except Exception as e:
                    logger.error(f"Failed to generate batch embeddings: {e}")
                    all_embeddings.extend([None] * len(batch_texts))
            
            logger.info(f"Generated embeddings for {len(all_embeddings)} texts")
            return all_embeddings
            
        except Exception as e:
            logger.error(f"Batch embedding generation failed: {e}")
            return [None] * len(texts)
    
    def embed_document_chunks(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Generate embeddings for document chunks
        
        Args:
            chunks: List of chunk objects from chunk_document()
            
        Returns:
            List of chunks with embeddings added
        """
        if not chunks:
            return []
        
        # Extract texts for batch embedding
        texts = [chunk["text"] for chunk in chunks]
        
        # Generate embeddings
        embeddings = self.generate_embeddings_batch(texts)
        
        # Add embeddings to chunks
        embedded_chunks = []
        for chunk, embedding in zip(chunks, embeddings):
            chunk_with_embedding = chunk.copy()
            chunk_with_embedding["embedding"] = embedding
            chunk_with_embedding["has_embedding"] = embedding is not None
            embedded_chunks.append(chunk_with_embedding)
        
        successful_embeddings = sum(1 for chunk in embedded_chunks if chunk["has_embedding"])
        logger.info(f"Successfully generated embeddings for {successful_embeddings}/{len(chunks)} chunks")
        
        return embedded_chunks
    
    def process_document_for_rag(self, document_content: str, document_id: str, metadata: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Complete pipeline: chunk document and generate embeddings
        
        Args:
            document_content: Full document text
            document_id: Unique document identifier
            metadata: Additional metadata for the document
            
        Returns:
            List of chunks with embeddings ready for vector storage
        """
        logger.info(f"Processing document {document_id} for RAG")
        
        # Step 1: Chunk the document
        chunks = self.chunk_document(document_content, document_id, metadata)
        
        if not chunks:
            logger.warning(f"No chunks created for document {document_id}")
            return []
        
        # Step 2: Generate embeddings for chunks
        embedded_chunks = self.embed_document_chunks(chunks)
        
        # Step 3: Filter out chunks without embeddings
        valid_chunks = [chunk for chunk in embedded_chunks if chunk["has_embedding"]]
        
        logger.info(f"Document {document_id} processed: {len(valid_chunks)} valid chunks ready for RAG")
        return valid_chunks
    
    def health_check(self) -> Dict[str, Any]:
        """Perform health check on embedding service"""
        try:
            # Test with a simple embedding
            test_text = "This is a test for the embedding service."
            test_embedding = self.generate_embedding(test_text)
            
            return {
                "status": "healthy",
                "model_initialized": self._model is not None,
                "embedding_successful": test_embedding is not None,
                "embedding_dimensions": len(test_embedding) if test_embedding else 0,
                "expected_dimensions": self.embedding_dimensions,
                "message": "Embedding service is operational"
            }
            
        except Exception as e:
            logger.error(f"Embedding service health check failed: {e}")
            return {
                "status": "unhealthy",
                "model_initialized": False,
                "embedding_successful": False,
                "error": str(e)
            }