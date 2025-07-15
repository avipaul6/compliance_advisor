# backend/app/services/rag_index_service.py
"""
RAG Index Service - Connects to deployed Vector Search index
Provides visibility and management of indexed documents
"""
import logging
from typing import List, Dict, Any, Optional
from google.cloud import aiplatform
from google.cloud import storage
from app.config import settings
import json
from datetime import datetime


logger = logging.getLogger(__name__)

class RAGIndexService:
    """Service to interact with the deployed Vector Search index"""
    
    def __init__(self):
        self.project_id = settings.PROJECT_ID
        self.region = settings.VECTOR_SEARCH_REGION
        self.endpoint_id = settings.VECTOR_INDEX_ENDPOINT_ID
        self.index_id = settings.VECTOR_INDEX_ID
        self.deployed_index_id = settings.VECTOR_DEPLOYED_INDEX_ID
        self.bucket_name = settings.STORAGE_BUCKET_NAME
        
        # Initialize clients
        aiplatform.init(project=self.project_id, location=self.region)
        self.storage_client = storage.Client(project=self.project_id)
        
        logger.info(f"RAG Index Service initialized for endpoint: {self.endpoint_id}")
    
    async def list_indexed_documents(self) -> List[Dict[str, Any]]:
        """
        List all documents currently indexed in Vector Search
        
        Returns:
            List of indexed documents with metadata
        """
        try:
            logger.info("Fetching indexed documents from Vector Search")
            
            # Since Vector Search doesn't have a direct "list documents" API,
            # we'll get this info from Cloud Storage metadata where we track indexing status
            indexed_docs = []
            
            # Query the bucket for documents with processing metadata
            bucket = self.storage_client.bucket(self.bucket_name)
            
            # Check different document type folders
            for doc_type in ['company', 'regulatory', 'austrac']:
                try:
                    blobs = bucket.list_blobs(prefix=f"{doc_type}/")
                    
                    for blob in blobs:
                        # Skip placeholder files
                        if blob.name.endswith('.placeholder'):
                            continue
                            
                        # Reload to get latest metadata
                        blob.reload()
                        metadata = blob.metadata or {}
                        
                        # Only include documents that have been processed (indexed)
                        if metadata.get("rag_processed") == "true":
                            doc_info = {
                                "id": metadata.get("unique_id", blob.name.split('/')[-1]),
                                "name": blob.name,
                                "content_uri": f"gs://{self.bucket_name}/{blob.name}",
                                "metadata": {
                                    "title": metadata.get("original_filename", blob.name.split('/')[-1]),
                                    "document_type": doc_type,
                                    "upload_timestamp": metadata.get("upload_timestamp"),
                                    "processing_timestamp": metadata.get("processing_timestamp"),
                                    "file_size": int(metadata.get("file_size", 0)) if metadata.get("file_size") else blob.size,
                                    "file_path": blob.name,
                                    "bucket": self.bucket_name
                                }
                            }
                            indexed_docs.append(doc_info)
                            
                except Exception as e:
                    logger.warning(f"Error processing {doc_type} documents: {e}")
                    continue
            
            logger.info(f"Found {len(indexed_docs)} indexed documents")
            return indexed_docs
            
        except Exception as e:
            logger.error(f"Error listing indexed documents: {e}")
            return []
    
    async def get_index_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about the Vector Search index
        
        Returns:
            Dictionary with index statistics
        """
        try:
            logger.info("Fetching Vector Search index statistics")
            
            # Get index information
            index_client = aiplatform.MatchingEngineIndex(
                index_name=f"projects/{self.project_id}/locations/{self.region}/indexes/{self.index_id}"
            )
            
            # Get endpoint information
            endpoint_client = aiplatform.MatchingEngineIndexEndpoint(
                index_endpoint_name=f"projects/{self.project_id}/locations/{self.region}/indexEndpoints/{self.endpoint_id}"
            )
            
            # Basic statistics
            stats = {
                "index_id": self.index_id,
                "endpoint_id": self.endpoint_id,
                "deployed_index_id": self.deployed_index_id,
                "region": self.region,
                "status": "active",  # We'll assume it's active if we can query it
                "embedding_dimensions": settings.EMBEDDING_DIMENSIONS,
                "last_updated": None  # Vector Search doesn't provide this directly
            }
            
            # Try to get more detailed info if available
            try:
                index_info = index_client.gca_resource
                stats["display_name"] = index_info.display_name
                stats["description"] = index_info.description
                stats["create_time"] = index_info.create_time.isoformat() if index_info.create_time else None
                stats["update_time"] = index_info.update_time.isoformat() if index_info.update_time else None
            except Exception as e:
                logger.warning(f"Could not fetch detailed index info: {e}")
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting index statistics: {e}")
            return {
                "error": str(e),
                "index_id": self.index_id,
                "status": "error"
            }
    
    async def check_document_index_status(self, document_id: str) -> Dict[str, Any]:
        """
        Check if a specific document is indexed
        
        Args:
            document_id: The document ID to check
            
        Returns:
            Dictionary with document index status
        """
        try:
            logger.info(f"Checking index status for document: {document_id}")
            
            # Search in bucket metadata for this document
            bucket = self.storage_client.bucket(self.bucket_name)
            
            # Search across all document types
            for doc_type in ['company', 'regulatory', 'austrac']:
                try:
                    blobs = bucket.list_blobs(prefix=f"{doc_type}/")
                    
                    for blob in blobs:
                        blob.reload()
                        metadata = blob.metadata or {}
                        
                        if metadata.get("unique_id") == document_id:
                            return {
                                "document_id": document_id,
                                "indexed": metadata.get("processed") == "true",
                                "processing_status": metadata.get("processed", "unknown"),
                                "upload_timestamp": metadata.get("upload_timestamp"),
                                "processing_timestamp": metadata.get("processing_timestamp"),
                                "error": metadata.get("processing_error"),
                                "file_path": blob.name
                            }
                            
                except Exception as e:
                    logger.warning(f"Error checking {doc_type} for document {document_id}: {e}")
                    continue
            
            return {
                "document_id": document_id,
                "indexed": False,
                "processing_status": "not_found",
                "error": "Document not found in storage"
            }
            
        except Exception as e:
            logger.error(f"Error checking document index status: {e}")
            return {
                "document_id": document_id,
                "indexed": False,
                "processing_status": "error",
                "error": str(e)
            }
    
    async def get_vector_search_health(self) -> Dict[str, Any]:
        """
        Check the health of the Vector Search deployment
        
        Returns:
            Health status information
        """
        try:
            logger.info("Checking Vector Search deployment health")
            
            # Try to connect to the index endpoint
            endpoint = aiplatform.MatchingEngineIndexEndpoint(
                index_endpoint_name=f"projects/{self.project_id}/locations/{self.region}/indexEndpoints/{self.endpoint_id}"
            )
            
            health_status = {
                "status": "healthy",
                "endpoint_id": self.endpoint_id,
                "index_id": self.index_id,
                "deployed_index_id": self.deployed_index_id,
                "region": self.region,
                "connection": "active"
            }
            
            # Try a simple query to test if the index is responsive
            try:
                # This is a minimal test - we'd need actual embeddings for a real query
                health_status["query_test"] = "not_tested"
                # In a real implementation, you'd do:
                # test_embedding = [0.0] * settings.EMBEDDING_DIMENSIONS
                # endpoint.find_neighbors(...)
            except Exception as e:
                health_status["query_test"] = f"failed: {str(e)}"
            
            return health_status
            
        except Exception as e:
            logger.error(f"Vector Search health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "endpoint_id": self.endpoint_id,
                "connection": "failed"
            }
    
    async def reindex_document(self, document_id: str) -> Dict[str, Any]:
        """
        Trigger reindexing of a specific document
        
        Args:
            document_id: The document ID to reindex
            
        Returns:
            Result of the reindexing operation
        """
        try:
            logger.info(f"Triggering reindex for document: {document_id}")
            
            # Find the document in storage
            bucket = self.storage_client.bucket(self.bucket_name)
            
            for doc_type in ['company', 'regulatory', 'austrac']:
                try:
                    blobs = bucket.list_blobs(prefix=f"{doc_type}/")
                    
                    for blob in blobs:
                        blob.reload()
                        metadata = blob.metadata or {}
                        
                        if metadata.get("unique_id") == document_id:
                            # Reset processing status to trigger reprocessing
                            updated_metadata = {**metadata}
                            updated_metadata["processed"] = "false"
                            updated_metadata["reindex_requested"] = "true"
                            updated_metadata["reindex_timestamp"] = str(datetime.now().isoformat())
                            
                            blob.metadata = updated_metadata
                            blob.patch()
                            
                            logger.info(f"Marked document {document_id} for reindexing")
                            
                            return {
                                "success": True,
                                "document_id": document_id,
                                "message": "Document marked for reindexing",
                                "file_path": blob.name
                            }
                            
                except Exception as e:
                    logger.warning(f"Error processing {doc_type} for reindex: {e}")
                    continue
            
            return {
                "success": False,
                "document_id": document_id,
                "message": "Document not found for reindexing"
            }
            
        except Exception as e:
            logger.error(f"Error triggering reindex for {document_id}: {e}")
            return {
                "success": False,
                "document_id": document_id,
                "message": f"Reindex failed: {str(e)}"
            }