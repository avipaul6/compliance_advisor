# backend/app/services/analysis_service.py - Updated for Multi-Document RAG
"""
Analysis Service - Updated for Multi-Document RAG Capabilities
Enhanced to leverage Vector Search and comprehensive document analysis
"""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import asyncio

from app.models.analysis_models import (
    GapReviewRequest, GapReviewResult, DeepDiveRequest, DeepDiveAnalysisResult,
    SuggestedChange, ActionPlanItem, CompanyDocument, AustracUpdate
)
from app.services.vertex_ai_service import VertexAIService
from app.config import settings

logger = logging.getLogger(__name__)

class AnalysisService:
    """Enhanced analysis service with multi-document RAG capabilities"""
    
    def __init__(self):
        """Initialize analysis service with RAG-enabled Vertex AI service"""
        self.vertex_ai_service = VertexAIService()
        self.max_documents_per_analysis = 50  # Increased for RAG capabilities
        self.max_concurrent_analyses = 5
        
        logger.info("Analysis Service initialized with RAG capabilities")
    
    async def perform_gap_review(self, request: GapReviewRequest) -> GapReviewResult:
        """
        Perform comprehensive gap review using multi-document RAG analysis
        
        Args:
            request: Gap review request with company documents and regulatory targets
            
        Returns:
            Comprehensive gap analysis results
        """
        logger.info(f"Starting multi-document gap review with {len(request.companyDocuments)} documents")
        
        try:
            # Step 1: Validate and prepare documents
            validated_docs = self._validate_and_prepare_documents(request.companyDocuments)
            
            if not validated_docs:
                return self._create_empty_gap_review("No valid documents provided for analysis")
            
            # Step 2: Extract regulatory target areas
            regulatory_targets = self._extract_regulatory_targets(request.selectedTargetIds)
            
            # Step 3: Perform RAG-based gap analysis
            gap_analysis_result = await self._perform_rag_gap_analysis(
                company_documents=validated_docs,
                regulatory_targets=regulatory_targets,
                austrac_content=request.allAustracContent
            )
            
            # Step 4: Convert to GapReviewResult format
            gap_review_result = self._convert_to_gap_review_result(gap_analysis_result, request)
            
            logger.info("Multi-document gap review completed successfully")
            return gap_review_result
            
        except Exception as e:
            logger.error(f"Gap review failed: {e}")
            return self._create_error_gap_review(str(e))
    
    async def _perform_rag_gap_analysis(
        self, 
        company_documents: List[Dict[str, Any]], 
        regulatory_targets: List[str],
        austrac_content: List[AustracUpdate]
    ) -> Dict[str, Any]:
        """Perform comprehensive RAG-based gap analysis"""
        
        # Step 1: Ingest documents into RAG system if needed
        logger.info("Ensuring documents are available in RAG system")
        
        # Prepare documents for RAG ingestion
        rag_documents = []
        
        # Add company documents
        for doc in company_documents:
            rag_documents.append({
                "id": f"company_{doc['id']}",
                "content": doc.get("textContent", ""),
                "metadata": {
                    "name": doc.get("name", "Unknown"),
                    "type": "company_document",
                    "size": doc.get("size", 0),
                    "document_type": "policy"
                }
            })
        
        # Add AUSTRAC content as regulatory documents
        for austrac_doc in austrac_content:
            rag_documents.append({
                "id": f"austrac_{austrac_doc.id}",
                "content": austrac_doc.rawContent,
                "metadata": {
                    "name": austrac_doc.title,
                    "type": "regulatory_document",
                    "date_added": austrac_doc.dateAdded,
                    "document_type": "regulatory"
                }
            })
        
        # Ingest documents into RAG system
        ingestion_result = self.vertex_ai_service.ingest_documents(rag_documents)
        logger.info(f"Document ingestion result: {ingestion_result.get('success', False)}")
        
        # Step 2: Perform gap analysis using RAG
        gap_analysis = self.vertex_ai_service.analyze_regulatory_gap(
            company_documents=company_documents,
            regulatory_targets=regulatory_targets
        )
        
        return gap_analysis
    
    def _validate_and_prepare_documents(self, documents: List[CompanyDocument]) -> List[Dict[str, Any]]:
        """Validate and prepare documents for RAG analysis"""
        validated_docs = []
        
        for doc in documents:
            # Check for required content
            if not hasattr(doc, 'textContent') or not doc.textContent.strip():
                logger.warning(f"Document {doc.name} has no text content, skipping")
                continue
            
            # Check document size
            if len(doc.textContent) < 100:
                logger.warning(f"Document {doc.name} is too short, skipping")
                continue
            
            validated_docs.append({
                "id": doc.id,
                "name": doc.name,
                "textContent": doc.textContent,
                "size": getattr(doc, 'size', len(doc.textContent)),
                "lastModified": getattr(doc, 'lastModified', datetime.now().isoformat())
            })
        
        logger.info(f"Validated {len(validated_docs)} out of {len(documents)} documents")
        return validated_docs
    
    def _extract_regulatory_targets(self, target_ids: List[str]) -> List[str]:
        """Extract and map regulatory target IDs to readable descriptions"""
        target_mapping = {
            "customer-identification": "Customer Identification and Verification",
            "transaction-monitoring": "Transaction Monitoring and Suspicious Activity Reporting",
            "record-keeping": "Record Keeping and Data Retention",
            "risk-assessment": "Risk Assessment and Customer Due Diligence",
            "aml-compliance": "Anti-Money Laundering Compliance Framework", 
            "sanctions-screening": "Sanctions Screening and Prohibited Persons",
            "reporting-obligations": "Regulatory Reporting Obligations to AUSTRAC and ASIC"
        }
        
        regulatory_targets = []
        for target_id in target_ids:
            readable_target = target_mapping.get(target_id, target_id.replace('-', ' ').title())
            regulatory_targets.append(readable_target)
        
        return regulatory_targets
    
    def _convert_to_gap_review_result(self, rag_analysis: Dict[str, Any], request: GapReviewRequest) -> GapReviewResult:
        """Convert RAG analysis results to GapReviewResult format"""
        
        overall_assessment = rag_analysis.get("overall_assessment", {})
        gap_analysis = rag_analysis.get("gap_analysis", [])
        
        # Convert gap analysis to suggested changes
        suggested_changes = []
        for gap in gap_analysis:
            suggested_changes.append(SuggestedChange(
                id=f"gap_{hash(gap.get('regulatory_area', ''))}",
                document_section=gap.get("regulatory_area", "General"),
                current_status_summary=gap.get("gap_description", "Gap identified"),
                austrac_relevance=f"Regulatory requirement: {gap.get('regulatory_area', 'General compliance')}",
                suggested_modification=gap.get("recommended_action", "Address compliance gap"),
                priority=gap.get("gap_severity", "Medium"),
                basis_of_suggestion="RAG Gap Analysis"
            ))
        
        # Convert implementation roadmap to action plan
        action_plan = []
        roadmap = rag_analysis.get("implementation_roadmap", [])
        for phase in roadmap:
            for activity in phase.get("key_activities", []):
                action_plan.append(ActionPlanItem(
                    id=f"roadmap_{hash(activity)}",
                    task=activity,
                    responsible="Compliance Team",
                    timeline=phase.get("duration", "30 days"),
                    priority_level="High" if "Phase 1" in phase.get("phase", "") else "Medium"
                ))
        
        return GapReviewResult(
            overall_summary=f"Multi-document gap analysis completed. Compliance maturity: {overall_assessment.get('compliance_maturity', 0.75):.0%}",
            key_themes_and_topics=overall_assessment.get("key_strengths", []) + overall_assessment.get("critical_gaps", []),
            suggested_changes=suggested_changes,
            action_plan=action_plan,
            additional_observations=f"Analysis covered {len(request.companyDocuments)} company documents against {len(request.selectedTargetIds)} regulatory areas. Overall risk level: {overall_assessment.get('overall_risk_level', 'Medium')}",
            referenced_regulatory_inputs=self._extract_referenced_inputs(request.allAustracContent, rag_analysis)
        )
    
    async def perform_deep_dive_analysis(self, request: DeepDiveRequest) -> DeepDiveAnalysisResult:
        """
        Perform deep dive analysis with enhanced RAG capabilities
        
        Args:
            request: Deep dive analysis request
            
        Returns:
            Detailed analysis of specific document with RAG enhancement
        """
        logger.info(f"Starting RAG-enhanced deep dive analysis")
        
        try:
            # Find target document
            target_doc = None
            for doc in request.companyDocuments:
                if doc.id == request.targetDocumentId:
                    target_doc = doc
                    break
            
            if not target_doc:
                raise ValueError(f"Target document {request.targetDocumentId} not found")
            
            # Prepare context with all available documents
            context_documents = []
            
            # Add all company documents to context
            for doc in request.companyDocuments:
                context_documents.append({
                    "id": f"company_{doc.id}",
                    "content": doc.textContent,
                    "metadata": {
                        "name": doc.name,
                        "type": "company_document",
                        "is_target": doc.id == request.targetDocumentId
                    }
                })
            
            # Add AUSTRAC content
            for austrac_doc in request.allAustracContent:
                context_documents.append({
                    "id": f"austrac_{austrac_doc.id}",
                    "content": austrac_doc.rawContent,
                    "metadata": {
                        "name": austrac_doc.title,
                        "type": "regulatory_document"
                    }
                })
            
            # Ingest context documents for analysis
            ingestion_result = self.vertex_ai_service.ingest_documents(context_documents)
            
            # Perform RAG-enhanced analysis
            analysis_result = self.vertex_ai_service.analyze_document_compliance(
                document_content=target_doc.textContent,
                document_name=target_doc.name
            )
            
            # Convert to DeepDiveAnalysisResult format
            deep_dive_result = self._convert_to_deep_dive_result(analysis_result, target_doc, request)
            
            logger.info("RAG-enhanced deep dive analysis completed")
            return deep_dive_result
            
        except Exception as e:
            logger.error(f"Deep dive analysis failed: {e}")
            return self._create_error_deep_dive(str(e))
    
    def _convert_to_deep_dive_result(
        self, 
        rag_analysis: Dict[str, Any], 
        target_doc: CompanyDocument, 
        request: DeepDiveRequest
    ) -> DeepDiveAnalysisResult:
        """Convert RAG analysis to DeepDiveAnalysisResult format"""
        
        # Convert suggested changes
        suggested_changes = []
        for change_data in rag_analysis.get("suggested_changes", []):
            suggested_changes.append(SuggestedChange(
                id=change_data.get("id", f"change_{hash(str(change_data))}"),
                document_section=change_data.get("document_section", "General"),
                current_status_summary=change_data.get("current_status_summary", "Current state"),
                austrac_relevance=change_data.get("austrac_relevance", "General compliance"),
                suggested_modification=change_data.get("suggested_modification", "Review and update"),
                priority=change_data.get("priority", "Medium"),
                basis_of_suggestion=change_data.get("basis_of_suggestion", "RAG Analysis")
            ))
        
        # Convert action plan
        action_plan = []
        for action_data in rag_analysis.get("action_plan", []):
            action_plan.append(ActionPlanItem(
                id=action_data.get("id", f"action_{hash(str(action_data))}"),
                task=action_data.get("task", "Review requirement"),
                responsible=action_data.get("responsible", "Compliance Team"),
                timeline=action_data.get("timeline", "30 days"),
                priority_level=action_data.get("priority_level", "Medium")
            ))
        
        return DeepDiveAnalysisResult(
            documentTitleAnalyzed=target_doc.name,
            overallSummary=rag_analysis.get("overall_summary", f"Analysis completed for {target_doc.name}"),
            keyThemesAndTopics=rag_analysis.get("key_themes", ["Document analysis"]),
            suggested_changes=suggested_changes,
            action_plan=action_plan,
            additionalObservations=rag_analysis.get("additional_observations", ""),
            referencedRegulatoryInputs=self._extract_referenced_inputs(request.allAustracContent, rag_analysis)
        )
    
    def _extract_referenced_inputs(self, austrac_content: List[AustracUpdate], analysis: Dict[str, Any]) -> List[str]:
        """Extract regulatory references from analysis"""
        references = []
        
        # Add references from source chunks if available
        source_chunks = analysis.get("source_chunks", [])
        for chunk in source_chunks:
            metadata = chunk.get("metadata", {})
            if metadata.get("type") == "regulatory_document":
                doc_name = metadata.get("name", "Unknown Regulatory Document")
                if doc_name not in references:
                    references.append(doc_name)
        
        # Fallback to AUSTRAC document titles
        if not references and austrac_content:
            references = [doc.title for doc in austrac_content[:5]]
        
        return references
    
    def _create_empty_gap_review(self, message: str) -> GapReviewResult:
        """Create empty gap review result"""
        return GapReviewResult(
            overall_summary=f"Gap review could not be completed: {message}",
            key_themes_and_topics=["Analysis incomplete"],
            suggested_changes=[],
            action_plan=[],
            additional_observations=message,
            referenced_regulatory_inputs=[]
        )
    
    def _create_error_gap_review(self, error_message: str) -> GapReviewResult:
        """Create error gap review result"""
        import uuid
        
        return GapReviewResult(
            overall_summary=f"Gap review encountered an error: {error_message}",
            key_themes_and_topics=["Error encountered", "Manual review required"],
            suggested_changes=[
                SuggestedChange(
                    id=f"error_{str(uuid.uuid4())[:8]}",
                    document_section="System Error",
                    current_status_summary="Analysis failed",
                    austrac_relevance="Manual review required",
                    suggested_modification="Conduct manual gap analysis",
                    priority="High",
                    basis_of_suggestion="System error fallback"
                )
            ],
            action_plan=[
                ActionPlanItem(
                    id=f"error_action_{str(uuid.uuid4())[:8]}",
                    task="Investigate analysis failure and conduct manual review",
                    responsible="Technical Team & Compliance Team",
                    timeline="3 days",
                    priority_level="High"
                )
            ],
            additional_observations=f"System error occurred during analysis: {error_message}",
            referenced_regulatory_inputs=[]
        )
    
    def _create_error_deep_dive(self, error_message: str) -> DeepDiveAnalysisResult:
        """Create error deep dive result"""
        import uuid
        
        return DeepDiveAnalysisResult(
            documentTitleAnalyzed="Analysis Error",
            overallSummary=f"Deep dive analysis failed: {error_message}",
            keyThemesAndTopics=["Error encountered", "Manual analysis required"],
            suggested_changes=[
                SuggestedChange(
                    id=f"error_{str(uuid.uuid4())[:8]}",
                    document_section="System Error",
                    current_status_summary="Analysis failed",
                    austrac_relevance="Manual review required",
                    suggested_modification="Conduct manual document analysis",
                    priority="High",
                    basis_of_suggestion="System error fallback"
                )
            ],
            action_plan=[
                ActionPlanItem(
                    id=f"error_action_{str(uuid.uuid4())[:8]}",
                    task="Investigate analysis failure and conduct manual review",
                    responsible="Technical Team & Compliance Team",
                    timeline="3 days",
                    priority_level="High"
                )
            ],
            additionalObservations=f"Deep dive analysis failed: {error_message}",
            referencedRegulatoryInputs=[]
        )
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check on analysis service"""
        try:
            # Check Vertex AI service health
            vertex_health = self.vertex_ai_service.health_check()
            
            analysis_healthy = vertex_health.get("status") == "healthy"
            
            return {
                "status": "healthy" if analysis_healthy else "unhealthy",
                "service_type": "RAG-Enhanced Analysis Service",
                "vertex_ai_service": vertex_health,
                "capabilities": {
                    "multi_document_analysis": True,
                    "rag_enhanced": True,
                    "max_documents": self.max_documents_per_analysis,
                    "concurrent_analyses": self.max_concurrent_analyses
                },
                "message": "Analysis Service with RAG capabilities"
            }
            
        except Exception as e:
            logger.error(f"Analysis service health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "message": "Analysis service health check failed"
            }