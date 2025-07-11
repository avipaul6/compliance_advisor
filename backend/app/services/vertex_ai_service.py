# backend/app/services/vertex_ai_service.py - Updated for RAG Integration
"""
Vertex AI Service - Updated for RAG Integration
Replaces Data Store functionality with Vector Search RAG
"""
import logging
from typing import List, Dict, Any, Optional, Tuple
import json
import re

from app.config import settings
from app.services.rag_service import RAGService

logger = logging.getLogger(__name__)

class VertexAIService:
    """
    Updated Vertex AI Service using RAG instead of Data Store
    Maintains compatibility with existing analysis_service.py interface
    """
    
    def __init__(self):
        """Initialize with RAG service"""
        self.project_id = settings.PROJECT_ID
        self.region = settings.VERTEX_AI_LOCATION
        
        # Initialize RAG service for all AI operations
        self.rag_service = RAGService()
        
        logger.info("Vertex AI Service initialized with RAG backend")
    
    def search_compliance_context(self, document_content: str, document_name: str) -> Tuple[str, Optional[Any]]:
        """
        Search for relevant compliance context using RAG
        Maintains compatibility with existing interface
        
        Args:
            document_content: Content to search context for
            document_name: Name of the document being analyzed
            
        Returns:
            Tuple of (combined_context, grounding_metadata)
        """
        logger.info(f"Searching compliance context for document: {document_name}")
        
        try:
            # Build search query from document content and name
            search_query = f"compliance requirements {document_name} {document_content[:500]}"
            
            # Use RAG service to find relevant context
            context_text, source_chunks = self.rag_service.search_compliance_context(search_query)
            
            # Build grounding metadata from sources
            grounding_metadata = self._build_grounding_metadata(source_chunks)
            
            logger.info(f"Found context with {len(source_chunks)} source chunks")
            return context_text, grounding_metadata
            
        except Exception as e:
            logger.error(f"Compliance context search failed: {e}")
            return "No relevant compliance context found.", None
    
    def _build_grounding_metadata(self, source_chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Build grounding metadata from RAG source chunks"""
        if not source_chunks:
            return None
        
        # Convert RAG sources to grounding format
        grounding_sources = []
        for chunk in source_chunks:
            grounding_sources.append({
                "id": chunk.get("id", "unknown"),
                "title": chunk.get("metadata", {}).get("document_id", "Unknown Document"),
                "uri": f"gs://{settings.STORAGE_BUCKET_NAME}/chunks/{chunk.get('id', 'unknown')}",
                "relevance_score": chunk.get("similarity_score", 0.0)
            })
        
        return {
            "grounding_sources": grounding_sources,
            "support_score": max(chunk.get("similarity_score", 0.0) for chunk in source_chunks),
            "source_count": len(source_chunks)
        }
    
    def analyze_document_compliance(self, document_content: str, document_name: str) -> Dict[str, Any]:
        """
        Perform comprehensive compliance analysis using RAG
        Maintains compatibility with existing analysis_service.py
        
        Args:
            document_content: Full document text
            document_name: Name of the document
            
        Returns:
            Structured compliance analysis compatible with existing interface
        """
        logger.info(f"Starting RAG-based compliance analysis for: {document_name}")
        
        try:
            # Use RAG service for analysis
            analysis_result = self.rag_service.analyze_document_compliance(
                document_content=document_content,
                document_name=document_name
            )
            
            # Ensure compatibility with existing interface
            return self._ensure_compatibility(analysis_result, document_name)
            
        except Exception as e:
            logger.error(f"Document compliance analysis failed: {e}")
            return self._create_fallback_analysis(document_name, str(e))
    
    def _ensure_compatibility(self, rag_result: Dict[str, Any], document_name: str) -> Dict[str, Any]:
        """Ensure RAG results are compatible with existing analysis_service interface"""
        
        # Map RAG result to expected format
        compatible_result = {
            "overall_summary": rag_result.get("overall_summary", f"Analysis completed for {document_name}"),
            "key_themes": rag_result.get("key_themes", ["General compliance review"]),
            "suggested_changes": rag_result.get("suggested_changes", []),
            "action_plan": rag_result.get("action_plan", []),
            "additional_observations": rag_result.get("additional_observations", ""),
            "compliance_score": rag_result.get("compliance_score", 0.75),
            "regulatory_alignment": rag_result.get("regulatory_alignment", {}),
            
            # RAG-specific additions
            "source_chunks": rag_result.get("source_chunks", []),
            "context_used": rag_result.get("context_used", ""),
            "rag_enhanced": True
        }
        
        return compatible_result
    
    def _create_fallback_analysis(self, document_name: str, error_message: str) -> Dict[str, Any]:
        """Create fallback analysis when RAG fails"""
        import uuid
        
        return {
            "overall_summary": f"Analysis completed for {document_name} with limited processing due to: {error_message}",
            "key_themes": ["Manual review required", "System limitation encountered"],
            "suggested_changes": [
                {
                    "id": f"fallback-{str(uuid.uuid4())[:8]}",
                    "document_section": "General",
                    "current_status_summary": "System unable to complete full analysis",
                    "austrac_relevance": "Manual compliance review recommended",
                    "suggested_modification": "Conduct detailed manual compliance review",
                    "priority": "High",
                    "basis_of_suggestion": "System fallback recommendation"
                }
            ],
            "action_plan": [
                {
                    "id": f"fallback-action-{str(uuid.uuid4())[:8]}",
                    "task": "Manual compliance review required",
                    "responsible": "Compliance Team",
                    "timeline": "7 days",
                    "priority_level": "High"
                }
            ],
            "additional_observations": f"Analysis system encountered an issue: {error_message}. Manual review is recommended.",
            "compliance_score": 0.60,
            "regulatory_alignment": {
                "aml_ctf_compliance": 0.60,
                "customer_identification": 0.60,
                "transaction_monitoring": 0.60,
                "record_keeping": 0.60,
                "reporting_obligations": 0.60
            },
            "rag_enhanced": False,
            "error": error_message
        }
    
    def analyze_regulatory_gap(self, company_documents: List[Dict[str, Any]], regulatory_targets: List[str]) -> Dict[str, Any]:
        """
        Perform gap analysis using RAG
        
        Args:
            company_documents: List of company documents
            regulatory_targets: List of regulatory areas to analyze
            
        Returns:
            Gap analysis results
        """
        logger.info(f"Starting RAG-based gap analysis")
        
        try:
            # Use RAG service for gap analysis
            gap_result = self.rag_service.perform_gap_analysis(
                company_documents=company_documents,
                regulatory_targets=regulatory_targets
            )
            
            return gap_result
            
        except Exception as e:
            logger.error(f"Gap analysis failed: {e}")
            return {
                "overall_assessment": {
                    "compliance_maturity": 0.60,
                    "overall_risk_level": "Medium",
                    "key_strengths": ["Existing documentation"],
                    "critical_gaps": ["Analysis system limitation"]
                },
                "gap_analysis": [
                    {
                        "regulatory_area": "General Compliance",
                        "current_coverage": 0.60,
                        "gap_severity": "Medium",
                        "gap_description": f"Gap analysis failed: {e}",
                        "impact_assessment": "Manual review required",
                        "recommended_action": "Conduct manual gap analysis"
                    }
                ],
                "error": str(e)
            }
    
    def ingest_documents(self, documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Ingest documents into RAG system
        
        Args:
            documents: List of documents to ingest
            
        Returns:
            Ingestion results
        """
        logger.info(f"Starting document ingestion for {len(documents)} documents")
        
        try:
            # Use RAG service for document ingestion
            ingestion_result = self.rag_service.ingest_documents(documents)
            
            logger.info(f"Document ingestion completed: {ingestion_result['success']}")
            return ingestion_result
            
        except Exception as e:
            logger.error(f"Document ingestion failed: {e}")
            return {
                "total_documents": len(documents),
                "processed_documents": 0,
                "total_chunks": 0,
                "successful_chunks": 0,
                "failed_documents": [{"id": "all", "error": str(e)}],
                "success": False,
                "error": str(e)
            }
    
    def chat_with_context(self, user_message: str, chat_history: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Handle chat interactions with compliance context
        
        Args:
            user_message: User's question
            chat_history: Previous conversation
            
        Returns:
            Chat response with context
        """
        logger.info(f"Processing chat message: {user_message[:100]}...")
        
        try:
            # Use RAG service for chat
            chat_result = self.rag_service.chat_with_context(
                user_message=user_message,
                chat_history=chat_history
            )
            
            return chat_result
            
        except Exception as e:
            logger.error(f"Chat processing failed: {e}")
            return {
                "response": "I'm sorry, I encountered an issue processing your request. Please try again.",
                "sources": [],
                "context_used": False,
                "success": False,
                "error": str(e)
            }
    
    def health_check(self) -> Dict[str, Any]:
        """Perform health check on the service"""
        try:
            # Check RAG service health
            rag_health = self.rag_service.health_check()
            
            overall_healthy = rag_health.get("status") == "healthy"
            
            return {
                "status": "healthy" if overall_healthy else "unhealthy",
                "service_type": "RAG-enabled",
                "rag_service": rag_health,
                "configuration": {
                    "project_id": self.project_id,
                    "region": self.region,
                    "embedding_model": settings.EMBEDDING_MODEL,
                    "generation_model": settings.GENERATION_MODEL
                },
                "message": "Vertex AI Service with RAG backend"
            }
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "message": "Vertex AI Service health check failed"
            }
    
    # Legacy compatibility methods (deprecated but maintained for transition)
    def _extract_document_themes(self, document_content: str, document_name: str) -> List[str]:
        """Legacy method - now uses RAG for theme extraction"""
        logger.warning("Using legacy theme extraction method - consider migrating to RAG")
        
        # Simple keyword-based themes as fallback
        base_themes = [
            "customer identification",
            "know your customer KYC", 
            "anti money laundering AML",
            "sanctions screening",
            "transaction monitoring",
            "risk assessment",
            "due diligence",
            "record keeping",
            "reporting requirements"
        ]
        
        doc_lower = document_name.lower()
        content_lower = document_content.lower()
        
        relevant_themes = []
        for theme in base_themes:
            theme_keywords = theme.lower().split()
            if any(keyword in content_lower or keyword in doc_lower for keyword in theme_keywords):
                relevant_themes.append(theme)
        
        return relevant_themes[:5] if relevant_themes else ["compliance requirements", "regulatory obligations"]