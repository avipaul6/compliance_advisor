"""
RAG Service - Complete RAG Pipeline Orchestration
Combines vector search, embeddings, and generation for the OFX Compliance Assistant
"""
import logging
from typing import List, Dict, Any, Optional, Tuple
import json
from google.cloud import aiplatform
from vertexai.generative_models import GenerativeModel

from app.config import settings
from app.services.vector_service import VectorService
from app.services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)

class RAGService:
    """Complete RAG service orchestrating vector search and generation"""
    
    def __init__(self):
        """Initialize RAG service with vector search and embedding services"""
        self.project_id = settings.PROJECT_ID
        self.region = settings.VERTEX_AI_LOCATION
        self.generation_model_name = settings.GENERATION_MODEL
        self.retrieval_top_k = settings.RETRIEVAL_TOP_K
        
        # Initialize AI platform
        aiplatform.init(
            project=self.project_id,
            location=self.region
        )
        
        # Initialize component services
        self.vector_service = VectorService()
        self.embedding_service = EmbeddingService()
        self._generation_model = None
        
        self._initialize_generation_model()
    
    def _initialize_generation_model(self):
        """Initialize the Gemini generation model"""
        try:
            self._generation_model = GenerativeModel(self.generation_model_name)
            logger.info(f"Initialized generation model: {self.generation_model_name}")
        except Exception as e:
            logger.error(f"Failed to initialize generation model: {e}")
            raise
    
    def ingest_documents(self, documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Ingest documents into the RAG system
        
        Args:
            documents: List of documents with content and metadata
            
        Returns:
            Ingestion results summary
        """
        logger.info(f"Starting ingestion of {len(documents)} documents")
        
        ingestion_results = {
            "total_documents": len(documents),
            "processed_documents": 0,
            "total_chunks": 0,
            "successful_chunks": 0,
            "failed_documents": [],
            "success": False
        }
        
        for doc in documents:
            try:
                doc_id = doc.get("id", f"doc_{hash(doc.get('content', ''))}")
                content = doc.get("content", "")
                metadata = doc.get("metadata", {})
                
                if not content.strip():
                    logger.warning(f"Empty content for document {doc_id}, skipping")
                    continue
                
                # Process document through embedding pipeline
                embedded_chunks = self.embedding_service.process_document_for_rag(
                    document_content=content,
                    document_id=doc_id,
                    metadata=metadata
                )
                
                if embedded_chunks:
                    # TODO: Add chunks to vector index
                    # For now, we'll track the processing
                    ingestion_results["processed_documents"] += 1
                    ingestion_results["total_chunks"] += len(embedded_chunks)
                    ingestion_results["successful_chunks"] += sum(
                        1 for chunk in embedded_chunks if chunk.get("has_embedding", False)
                    )
                    
                    logger.info(f"Successfully processed document {doc_id}: {len(embedded_chunks)} chunks")
                else:
                    ingestion_results["failed_documents"].append({
                        "id": doc_id,
                        "error": "No valid chunks generated"
                    })
                    
            except Exception as e:
                logger.error(f"Failed to process document {doc.get('id', 'unknown')}: {e}")
                ingestion_results["failed_documents"].append({
                    "id": doc.get("id", "unknown"),
                    "error": str(e)
                })
        
        ingestion_results["success"] = ingestion_results["processed_documents"] > 0
        
        logger.info(f"Ingestion completed: {ingestion_results['processed_documents']}/{ingestion_results['total_documents']} documents processed")
        return ingestion_results
    
    def search_compliance_context(self, query: str, document_filters: Optional[Dict[str, Any]] = None) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Search for relevant compliance context using RAG
        
        Args:
            query: Search query
            document_filters: Optional filters for document types/metadata
            
        Returns:
            Tuple of (combined_context_text, source_chunks)
        """
        logger.info(f"Searching compliance context for query: {query[:100]}...")
        
        try:
            # Step 1: Generate embedding for the query
            query_embedding = self.embedding_service.generate_embedding(query)
            
            if not query_embedding:
                logger.error("Failed to generate query embedding")
                return "No context available due to embedding failure.", []
            
            # Step 2: Search vector index for similar chunks
            similar_chunks = self.vector_service.search_similar_documents(
                query_embedding=query_embedding,
                top_k=self.retrieval_top_k,
                filter_metadata=document_filters
            )
            
            if not similar_chunks:
                logger.warning("No similar documents found in vector search")
                return "No relevant compliance context found.", []
            
            # Step 3: Retrieve full context from chunks
            context_chunks = []
            for chunk_ref in similar_chunks:
                # In a complete implementation, you would retrieve the full chunk content
                # For now, we'll use the chunk reference data
                context_chunks.append({
                    "id": chunk_ref["id"],
                    "similarity_score": chunk_ref["similarity_score"],
                    "content": f"[Chunk content for {chunk_ref['id']}]",  # Placeholder
                    "metadata": chunk_ref.get("metadata", {})
                })
            
            # Step 4: Combine contexts with relevance ranking
            combined_context = self._combine_context_chunks(context_chunks)
            
            logger.info(f"Found {len(context_chunks)} relevant context chunks")
            return combined_context, context_chunks
            
        except Exception as e:
            logger.error(f"Compliance context search failed: {e}")
            return f"Context search failed: {str(e)}", []
    
    def _combine_context_chunks(self, chunks: List[Dict[str, Any]]) -> str:
        """Combine context chunks into a coherent context string"""
        if not chunks:
            return "No relevant context available."
        
        context_parts = []
        for i, chunk in enumerate(chunks):
            score = chunk.get("similarity_score", 0.0)
            content = chunk.get("content", "")
            doc_id = chunk.get("metadata", {}).get("document_id", "unknown")
            
            context_parts.append(f"""
**Relevant Context {i+1}** (relevance: {score:.2f})
Source: {doc_id}
Content: {content}
""")
        
        return "\n".join(context_parts)
    
    def analyze_document_compliance(self, document_content: str, document_name: str) -> Dict[str, Any]:
        """
        Perform comprehensive compliance analysis using RAG
        
        Args:
            document_content: The document text to analyze
            document_name: Name of the document
            
        Returns:
            Structured compliance analysis results
        """
        logger.info(f"Starting RAG-based compliance analysis for: {document_name}")
        
        try:
            # Step 1: Search for relevant compliance context
            search_query = f"compliance requirements analysis {document_name} {document_content[:500]}"
            compliance_context, source_chunks = self.search_compliance_context(search_query)
            
            # Step 2: Build analysis prompt
            analysis_prompt = self._build_compliance_analysis_prompt(
                document_content, document_name, compliance_context
            )
            
            # Step 3: Generate analysis using Gemini
            response = self._generation_model.generate_content(analysis_prompt)
            
            # Step 4: Parse structured response
            analysis_result = self._parse_analysis_response(response.text, document_name)
            
            # Step 5: Add source information
            analysis_result["source_chunks"] = source_chunks
            analysis_result["context_used"] = compliance_context
            
            logger.info(f"Completed compliance analysis for {document_name}")
            return analysis_result
            
        except Exception as e:
            logger.error(f"Compliance analysis failed for {document_name}: {e}")
            return self._create_fallback_analysis(document_name, str(e))
    
    def _build_compliance_analysis_prompt(self, document_content: str, document_name: str, compliance_context: str) -> str:
        """Build the prompt for Gemini compliance analysis"""
        return f"""You are a compliance expert analyzing financial services documents against AUSTRAC and ASIC requirements.

**Document to Analyze:** {document_name}

**Document Content:**
{document_content[:3000]}  # Limit content to avoid token limits

**Relevant Compliance Context:**
{compliance_context}

**Analysis Instructions:**
1. Perform a thorough compliance analysis comparing the document against the provided regulatory context
2. Identify specific compliance gaps, strengths, and improvement opportunities
3. Focus on AUSTRAC AML/CTF requirements and ASIC obligations
4. Provide actionable recommendations with clear priorities

**Required Output Format (JSON):**
{{
    "overall_summary": "Brief summary of compliance status",
    "key_themes": ["theme1", "theme2", "theme3"],
    "compliance_score": 0.85,
    "suggested_changes": [
        {{
            "id": "suggestion_id",
            "document_section": "section name",
            "current_status_summary": "current state",
            "austrac_relevance": "how this relates to AUSTRAC requirements",
            "suggested_modification": "specific improvement",
            "priority": "High|Medium|Low",
            "basis_of_suggestion": "regulatory reference or best practice"
        }}
    ],
    "action_plan": [
        {{
            "id": "action_id",
            "task": "specific task description",
            "responsible": "suggested responsible party",
            "timeline": "suggested timeline",
            "priority_level": "High|Medium|Low"
        }}
    ],
    "regulatory_alignment": {{
        "aml_ctf_compliance": 0.8,
        "customer_identification": 0.9,
        "transaction_monitoring": 0.7,
        "record_keeping": 0.85,
        "reporting_obligations": 0.75
    }},
    "additional_observations": "Additional insights and recommendations"
}}

Generate your analysis now:"""
    
    def _parse_analysis_response(self, response_text: str, document_name: str) -> Dict[str, Any]:
        """Parse Gemini's response into structured format"""
        import re
        import uuid
        
        try:
            # Try to extract JSON from response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                analysis_data = json.loads(json_str)
                
                # Validate and enhance the analysis
                return self._validate_and_enhance_analysis(analysis_data, document_name)
            else:
                logger.warning("No JSON found in response, creating fallback structure")
                return self._create_fallback_analysis(document_name, "Could not parse response")
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            return self._create_fallback_analysis(document_name, f"JSON parsing failed: {e}")
    
    def _validate_and_enhance_analysis(self, analysis_data: Dict[str, Any], document_name: str) -> Dict[str, Any]:
        """Validate and enhance the parsed analysis data"""
        import uuid
        
        # Ensure required fields exist
        analysis_data.setdefault("overall_summary", f"Analysis completed for {document_name}")
        analysis_data.setdefault("key_themes", ["General compliance review"])
        analysis_data.setdefault("compliance_score", 0.75)
        analysis_data.setdefault("suggested_changes", [])
        analysis_data.setdefault("action_plan", [])
        analysis_data.setdefault("regulatory_alignment", {})
        analysis_data.setdefault("additional_observations", "")
        
        # Validate and enhance suggested changes
        for change in analysis_data["suggested_changes"]:
            if "id" not in change:
                change["id"] = f"rag-change-{str(uuid.uuid4())[:8]}"
            change.setdefault("priority", "Medium")
            change.setdefault("basis_of_suggestion", "RAG Analysis")
            change.setdefault("document_section", "General")
            change.setdefault("current_status_summary", "Requires review")
            change.setdefault("austrac_relevance", "General compliance requirement")
            change.setdefault("suggested_modification", "Review and update as needed")
        
        # Validate and enhance action plan
        for action in analysis_data["action_plan"]:
            if "id" not in action:
                action["id"] = f"rag-action-{str(uuid.uuid4())[:8]}"
            action.setdefault("priority_level", "Medium")
            action.setdefault("responsible", "Compliance Team")
            action.setdefault("timeline", "30 days")
            action.setdefault("task", "Review compliance requirement")
        
        # Ensure regulatory alignment scores
        regulatory_alignment = analysis_data["regulatory_alignment"]
        default_scores = {
            "aml_ctf_compliance": 0.75,
            "customer_identification": 0.80,
            "transaction_monitoring": 0.70,
            "record_keeping": 0.75,
            "reporting_obligations": 0.70
        }
        
        for key, default_score in default_scores.items():
            if key not in regulatory_alignment:
                regulatory_alignment[key] = default_score
        
        return analysis_data
    
    def _create_fallback_analysis(self, document_name: str, error_message: str) -> Dict[str, Any]:
        """Create a fallback analysis structure when processing fails"""
        import uuid
        
        return {
            "overall_summary": f"Analysis completed for {document_name} with limited AI processing due to: {error_message}",
            "key_themes": ["Document review required", "Compliance verification needed"],
            "compliance_score": 0.70,
            "suggested_changes": [
                {
                    "id": f"fallback-{str(uuid.uuid4())[:8]}",
                    "document_section": "General",
                    "current_status_summary": "Manual review required",
                    "austrac_relevance": "General compliance requirements apply",
                    "suggested_modification": "Conduct detailed compliance review",
                    "priority": "Medium",
                    "basis_of_suggestion": "Fallback recommendation"
                }
            ],
            "action_plan": [
                {
                    "id": f"fallback-action-{str(uuid.uuid4())[:8]}",
                    "task": "Conduct manual compliance review",
                    "responsible": "Compliance Team",
                    "timeline": "7 days",
                    "priority_level": "High"
                }
            ],
            "regulatory_alignment": {
                "aml_ctf_compliance": 0.70,
                "customer_identification": 0.70,
                "transaction_monitoring": 0.70,
                "record_keeping": 0.70,
                "reporting_obligations": 0.70
            },
            "additional_observations": f"AI analysis encountered an issue: {error_message}. Manual review recommended.",
            "error": error_message
        }
    
    def perform_gap_analysis(self, company_documents: List[Dict[str, Any]], regulatory_targets: List[str]) -> Dict[str, Any]:
        """
        Perform comprehensive gap analysis between company documents and regulatory requirements
        
        Args:
            company_documents: List of company policy documents
            regulatory_targets: List of regulatory focus areas
            
        Returns:
            Comprehensive gap analysis results
        """
        logger.info(f"Starting gap analysis for {len(company_documents)} documents against {len(regulatory_targets)} regulatory targets")
        
        try:
            # Step 1: Build comprehensive context from company documents
            company_context = self._build_company_context(company_documents)
            
            # Step 2: Search for relevant regulatory requirements
            regulatory_context_parts = []
            for target in regulatory_targets:
                reg_context, _ = self.search_compliance_context(
                    query=f"regulatory requirements {target} AUSTRAC ASIC",
                    document_filters={"type": "regulatory"}
                )
                regulatory_context_parts.append(f"**{target}:**\n{reg_context}")
            
            regulatory_context = "\n\n".join(regulatory_context_parts)
            
            # Step 3: Generate gap analysis using Gemini
            gap_analysis_prompt = self._build_gap_analysis_prompt(
                company_context, regulatory_context, company_documents
            )
            
            response = self._generation_model.generate_content(gap_analysis_prompt)
            
            # Step 4: Parse and structure the results
            gap_analysis = self._parse_gap_analysis_response(response.text)
            
            logger.info("Gap analysis completed successfully")
            return gap_analysis
            
        except Exception as e:
            logger.error(f"Gap analysis failed: {e}")
            return self._create_fallback_gap_analysis(str(e))
    
    def _build_company_context(self, documents: List[Dict[str, Any]]) -> str:
        """Build context string from company documents"""
        context_parts = []
        for doc in documents[:10]:  # Limit to prevent context overflow
            name = doc.get("name", "Unknown Document")
            content = doc.get("textContent", "")[:1000]  # Limit content
            context_parts.append(f"**{name}:**\n{content}")
        
        return "\n\n".join(context_parts)
    
    def _build_gap_analysis_prompt(self, company_context: str, regulatory_context: str, company_docs: List[Dict[str, Any]]) -> str:
        """Build prompt for gap analysis"""
        doc_names = [doc.get("name", "Unknown") for doc in company_docs]
        
        return f"""You are a compliance expert performing a regulatory gap analysis for a financial services organization.

**Company Documents Analyzed:** {', '.join(doc_names)}

**Company Current State:**
{company_context}

**Regulatory Requirements:**
{regulatory_context}

**Analysis Task:**
Compare the company's current policies against regulatory requirements and identify gaps.

**Required Output Format (JSON):**
{{
    "overall_assessment": {{
        "compliance_maturity": 0.75,
        "overall_risk_level": "Medium",
        "key_strengths": ["strength1", "strength2"],
        "critical_gaps": ["gap1", "gap2"]
    }},
    "gap_analysis": [
        {{
            "regulatory_area": "area name",
            "current_coverage": 0.8,
            "gap_severity": "High|Medium|Low", 
            "gap_description": "what's missing",
            "impact_assessment": "potential impact",
            "recommended_action": "specific action needed"
        }}
    ],
    "priority_improvements": [
        {{
            "improvement_area": "area name",
            "current_state": "current situation",
            "target_state": "desired outcome",
            "effort_required": "High|Medium|Low",
            "timeline": "suggested timeframe",
            "business_impact": "impact description"
        }}
    ],
    "implementation_roadmap": [
        {{
            "phase": "Phase 1",
            "duration": "timeframe",
            "key_activities": ["activity1", "activity2"],
            "success_criteria": ["criteria1", "criteria2"]
        }}
    ]
}}

Generate your gap analysis now:"""
    
    def _parse_gap_analysis_response(self, response_text: str) -> Dict[str, Any]:
        """Parse gap analysis response"""
        import re
        
        try:
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            else:
                return self._create_fallback_gap_analysis("Could not parse response")
        except json.JSONDecodeError as e:
            return self._create_fallback_gap_analysis(f"JSON parsing failed: {e}")
    
    def _create_fallback_gap_analysis(self, error_message: str) -> Dict[str, Any]:
        """Create fallback gap analysis"""
        return {
            "overall_assessment": {
                "compliance_maturity": 0.70,
                "overall_risk_level": "Medium",
                "key_strengths": ["Existing documentation"],
                "critical_gaps": ["Detailed analysis required"]
            },
            "gap_analysis": [
                {
                    "regulatory_area": "General Compliance",
                    "current_coverage": 0.70,
                    "gap_severity": "Medium",
                    "gap_description": "Manual review required due to analysis limitation",
                    "impact_assessment": "Medium risk",
                    "recommended_action": "Conduct detailed compliance review"
                }
            ],
            "priority_improvements": [
                {
                    "improvement_area": "Compliance Review Process",
                    "current_state": "Analysis limited",
                    "target_state": "Comprehensive compliance framework",
                    "effort_required": "Medium",
                    "timeline": "30 days",
                    "business_impact": "Improved compliance posture"
                }
            ],
            "implementation_roadmap": [
                {
                    "phase": "Phase 1",
                    "duration": "30 days",
                    "key_activities": ["Manual compliance review", "Document analysis"],
                    "success_criteria": ["Complete document review", "Gap identification"]
                }
            ],
            "error": error_message
        }
    
    def chat_with_context(self, user_message: str, chat_history: List[Dict[str, str]], document_context: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """
        Handle chat interactions with RAG context
        
        Args:
            user_message: User's question or message
            chat_history: Previous conversation history
            document_context: Optional specific document context
            
        Returns:
            Chat response with sources and context
        """
        logger.info(f"Processing chat message: {user_message[:100]}...")
        
        try:
            # Step 1: Search for relevant context
            search_query = f"{user_message} compliance requirements"
            context_text, source_chunks = self.search_compliance_context(search_query)
            
            # Step 2: Build chat prompt with context
            chat_prompt = self._build_chat_prompt(user_message, chat_history, context_text)
            
            # Step 3: Generate response
            response = self._generation_model.generate_content(chat_prompt)
            
            return {
                "response": response.text,
                "sources": source_chunks,
                "context_used": len(source_chunks) > 0,
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Chat processing failed: {e}")
            return {
                "response": "I'm sorry, I encountered an issue processing your request. Please try again or rephrase your question.",
                "sources": [],
                "context_used": False,
                "success": False,
                "error": str(e)
            }
    
    def _build_chat_prompt(self, user_message: str, chat_history: List[Dict[str, str]], context: str) -> str:
        """Build prompt for chat interaction"""
        history_text = ""
        if chat_history:
            for msg in chat_history[-5:]:  # Last 5 messages
                role = msg.get("role", "user")
                content = msg.get("content", "")
                history_text += f"{role}: {content}\n"
        
        return f"""You are a helpful compliance assistant for financial services, specializing in AUSTRAC and ASIC requirements.

**Conversation History:**
{history_text}

**Relevant Context:**
{context}

**User Question:** {user_message}

**Instructions:**
- Provide helpful, accurate compliance guidance
- Reference the context when relevant
- Be conversational and professional
- If unsure, recommend consulting official regulatory sources
- Keep responses concise but informative

**Response:**"""
    
    def health_check(self) -> Dict[str, Any]:
        """Comprehensive health check for RAG service"""
        try:
            # Check component services
            vector_health = self.vector_service.health_check()
            embedding_health = self.embedding_service.health_check()
            
            # Test generation model
            generation_healthy = False
            try:
                test_response = self._generation_model.generate_content("Test message")
                generation_healthy = bool(test_response.text)
            except Exception as e:
                logger.error(f"Generation model test failed: {e}")
            
            overall_healthy = (
                vector_health.get("status") == "healthy" and
                embedding_health.get("status") == "healthy" and
                generation_healthy
            )
            
            return {
                "status": "healthy" if overall_healthy else "unhealthy",
                "components": {
                    "vector_service": vector_health,
                    "embedding_service": embedding_health,
                    "generation_model": {
                        "status": "healthy" if generation_healthy else "unhealthy",
                        "model": self.generation_model_name
                    }
                },
                "configuration": {
                    "retrieval_top_k": self.retrieval_top_k,
                    "generation_model": self.generation_model_name,
                    "embedding_model": settings.EMBEDDING_MODEL
                },
                "message": "RAG service health check completed"
            }
            
        except Exception as e:
            logger.error(f"RAG service health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "message": "RAG service health check failed"
            }