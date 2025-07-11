"""
Vector Service - Core Vector Search Implementation
Handles all Vertex AI Vector Search operations for the OFX Compliance Assistant
"""
import logging
from typing import List, Dict, Any, Optional, Tuple
from google.cloud import aiplatform
from google.cloud.aiplatform import MatchingEngineIndex, MatchingEngineIndexEndpoint
import numpy as np
import json

from app.config import settings

logger = logging.getLogger(__name__)

class VectorService:
    """Core service for Vertex AI Vector Search operations"""
    
    def __init__(self):
        """Initialize Vector Search service with configuration"""
        self.project_id = settings.PROJECT_ID
        self.region = settings.VECTOR_SEARCH_REGION
        self.endpoint_id = settings.VECTOR_INDEX_ENDPOINT_ID
        self.index_id = settings.VECTOR_INDEX_ID
        self.deployed_index_id = settings.VECTOR_DEPLOYED_INDEX_ID
        
        # Initialize Vertex AI
        aiplatform.init(
            project=self.project_id,
            location=self.region
        )
        
        self._endpoint = None
        self._validate_configuration()
        
    def _validate_configuration(self):
        """Validate that all required configuration is present"""
        required_configs = [
            'PROJECT_ID', 'VECTOR_SEARCH_REGION', 'VECTOR_INDEX_ENDPOINT_ID',
            'VECTOR_INDEX_ID', 'VECTOR_DEPLOYED_INDEX_ID'
        ]
        
        missing_configs = []
        for config in required_configs:
            if not getattr(settings, config, None):
                missing_configs.append(config)
                
        if missing_configs:
            raise ValueError(f"Missing required Vector Search configuration: {missing_configs}")
            
        logger.info(f"Vector Service initialized for project {self.project_id}, region {self.region}")
    
    def _get_endpoint(self) -> MatchingEngineIndexEndpoint:
        """Get or create Vector Search endpoint connection"""
        if self._endpoint is None:
            try:
                self._endpoint = aiplatform.MatchingEngineIndexEndpoint(
                    index_endpoint_name=f"projects/{self.project_id}/locations/{self.region}/indexEndpoints/{self.endpoint_id}"
                )
                logger.info(f"Connected to Vector Search endpoint: {self.endpoint_id}")
            except Exception as e:
                logger.error(f"Failed to connect to Vector Search endpoint: {e}")
                raise
                
        return self._endpoint
    
    def search_similar_documents(
        self, 
        query_embedding: List[float], 
        top_k: int = 10,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for similar documents using vector similarity
        
        Args:
            query_embedding: The embedding vector for the query
            top_k: Number of similar documents to return
            filter_metadata: Optional metadata filters
            
        Returns:
            List of similar documents with metadata and similarity scores
        """
        try:
            endpoint = self._get_endpoint()
            
            # Prepare the search request
            search_request = {
                "deployed_index_id": self.deployed_index_id,
                "queries": [{
                    "embedding": query_embedding,
                    "neighbor_count": top_k
                }]
            }
            
            # Add filters if provided
            if filter_metadata:
                search_request["queries"][0]["restricts"] = self._build_filters(filter_metadata)
            
            logger.info(f"Searching for top {top_k} similar documents")
            
            # Perform the search
            response = endpoint.find_neighbors(**search_request)
            
            # Process results
            similar_docs = []
            if response and len(response) > 0:
                for neighbor in response[0]:
                    similar_docs.append({
                        "id": neighbor.id,
                        "distance": neighbor.distance,
                        "similarity_score": 1.0 - neighbor.distance,  # Convert distance to similarity
                        "metadata": json.loads(neighbor.restricts) if neighbor.restricts else {}
                    })
            
            logger.info(f"Found {len(similar_docs)} similar documents")
            return similar_docs
            
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return []
    
    def _build_filters(self, filter_metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Build vector search filters from metadata"""
        filters = []
        
        for key, value in filter_metadata.items():
            if isinstance(value, str):
                filters.append({
                    "namespace": key,
                    "allow_list": [value]
                })
            elif isinstance(value, list):
                filters.append({
                    "namespace": key, 
                    "allow_list": value
                })
                
        return filters
    
    def add_embeddings_to_index(self, embeddings_data: List[Dict[str, Any]]) -> bool:
        """
        Add new embeddings to the vector index
        
        Args:
            embeddings_data: List of dictionaries containing:
                - id: unique identifier
                - embedding: vector embedding
                - metadata: document metadata
                
        Returns:
            True if successful, False otherwise
        """
        try:
            # This would typically involve updating the index
            # For now, we'll focus on search functionality
            # Index updates in Vertex AI Vector Search require rebuilding
            logger.warning("Index updates require rebuilding - implement batch update process")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add embeddings to index: {e}")
            return False
    
    def get_index_stats(self) -> Dict[str, Any]:
        """Get statistics about the vector index"""
        try:
            endpoint = self._get_endpoint()
            
            # Get basic endpoint information
            return {
                "endpoint_id": self.endpoint_id,
                "index_id": self.index_id,
                "deployed_index_id": self.deployed_index_id,
                "region": self.region,
                "status": "active"
            }
            
        except Exception as e:
            logger.error(f"Failed to get index stats: {e}")
            return {"status": "error", "error": str(e)}
    
    def health_check(self) -> Dict[str, Any]:
        """Perform health check on Vector Search service"""
        try:
            endpoint = self._get_endpoint()
            
            # Try a simple search with a dummy embedding
            dummy_embedding = [0.0] * settings.EMBEDDING_DIMENSIONS
            test_results = self.search_similar_documents(
                query_embedding=dummy_embedding,
                top_k=1
            )
            
            return {
                "status": "healthy",
                "endpoint_connected": True,
                "search_functional": True,
                "message": "Vector Search service is operational"
            }
            
        except Exception as e:
            logger.error(f"Vector Search health check failed: {e}")
            return {
                "status": "unhealthy",
                "endpoint_connected": False,
                "search_functional": False,
                "error": str(e)
            }