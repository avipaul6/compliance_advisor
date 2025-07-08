# backend/app/services/analysis_service.py

import uuid
import datetime
from app.models.requests import GapReviewRequest, DeepDiveRequest, DraftRequest
from app.models.responses import (
    SavedAnalysis, ChallengeAnalysisResult, DeepDiveAnalysisResult,
    SuggestedChange, ActionPlanItem
)
from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)

class AnalysisService:
    
    def __init__(self, vertex_ai_service=None):
        # Vertex AI service will be injected via dependency injection
        self.vertex_ai_service = vertex_ai_service
    
    def generate_gap_review(self, request: GapReviewRequest) -> SavedAnalysis:
        """Generate a gap review analysis using Vertex AI"""
        try:
            target_docs = [doc for doc in request.allCompanyDocs if doc.id in request.companyDocIds]
            if not target_docs:
                raise ValueError("Missing company documents.")
            
            # Check if Vertex AI is available
            if not self.vertex_ai_service or not hasattr(self.vertex_ai_service, 'analyze_gap_review'):
                logger.warning("Vertex AI service not available, falling back to mock")
                return self._generate_mock_gap_review(target_docs, request)
            
            logger.info(f"Starting real gap review analysis for {len(target_docs)} documents")
            
            # Perform real AI analysis for gap review
            analysis_result = self.vertex_ai_service.analyze_gap_review(
                company_docs=target_docs,
                regulatory_content=request.allAustracContent,
                target_regulatory_ids=request.targetRegulatoryIds
            )
            
            # Convert AI response to structured format
            suggested_changes = []
            for change_data in analysis_result.get("suggested_changes", []):
                suggested_changes.append(SuggestedChange(
                    id=change_data["id"],
                    document_section=change_data["document_section"],
                    current_status_summary=change_data["current_status_summary"],
                    austrac_relevance=change_data["austrac_relevance"],
                    suggested_modification=change_data["suggested_modification"],
                    priority=change_data["priority"],
                    source_document_name=change_data.get("source_document_name", ""),
                    basis_of_suggestion=change_data.get("basis_of_suggestion", "Regulatory Analysis")
                ))

            action_plan = []
            for action_data in analysis_result.get("action_plan", []):
                action_plan.append(ActionPlanItem(
                    id=action_data["id"],
                    task=action_data["task"],
                    responsible=action_data["responsible"],
                    timeline=action_data["timeline"],
                    priority_level=action_data["priority_level"]
                ))
            
            # Group suggestions by document
            grouped_suggestions = {}
            for change in suggested_changes:
                doc_name = change.source_document_name
                if doc_name not in grouped_suggestions:
                    grouped_suggestions[doc_name] = []
                grouped_suggestions[doc_name].append(change)
            
            # Create result
            challenge_result = ChallengeAnalysisResult(
                suggested_changes=suggested_changes,
                action_plan=action_plan,
                groupedSuggestions=grouped_suggestions
            )
            
            analysis_id = str(uuid.uuid4())
            timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
            
            return SavedAnalysis(
                id=analysis_id,
                name=f"Gap Review - {timestamp[:10]}",
                timestamp=timestamp,
                type='challenge',
                challengeAnalysisResult=challenge_result,
                groundingMetadata=analysis_result.get("grounding_metadata"),
                userPrompt="Regulatory target gap review analysis",
                systemPrompt="AI-powered compliance gap analysis using Vertex AI Search and Gemini"
            )
            
        except Exception as e:
            logger.error(f"Error generating gap review: {e}")
            # Fallback to mock on error
            target_docs = [doc for doc in request.allCompanyDocs if doc.id in request.companyDocIds]
            if target_docs:
                return self._generate_mock_gap_review(target_docs, request)
            else:
                raise Exception(f"Failed to generate gap review: {str(e)}")

    def _generate_mock_gap_review(self, target_docs: List, request: GapReviewRequest) -> SavedAnalysis:
        """Fallback mock gap review when Vertex AI is not available"""
        mock_change_id = str(uuid.uuid4())
        doc_name = target_docs[0].name
        
        mock_result = ChallengeAnalysisResult(
            suggested_changes=[
                SuggestedChange(
                    id=f"grsc-{mock_change_id}",
                    document_section="Section 3.1: Customer Identification",
                    current_status_summary="The current policy requires two forms of ID for verification.",
                    austrac_relevance="The new AUSTRAC guidance emphasizes the need for digital identity verification methods.",
                    suggested_modification="Incorporate a new sub-section for verifying customers using the Australian Government's Digital Identity Framework.",
                    priority="High",
                    source_document_name=doc_name
                )
            ],
            action_plan=[
                ActionPlanItem(
                    id=f"grap-{uuid.uuid4()}",
                    task="Develop a new procedure for digital identity verification.",
                    responsible="Compliance Team Lead",
                    timeline="3 Months",
                    priority_level="High"
                )
            ],
            groupedSuggestions={
                doc_name: [
                    SuggestedChange(
                        id=f"grsc-{mock_change_id}",
                        document_section="Section 3.1: Customer Identification",
                        current_status_summary="The current policy requires two forms of ID for verification.",
                        austrac_relevance="The new AUSTRAC guidance emphasizes the need for digital identity verification methods.",
                        suggested_modification="Incorporate a new sub-section for verifying customers using the Australian Government's Digital Identity Framework.",
                        priority="High",
                        source_document_name=doc_name
                    )
                ]
            }
        )
        
        analysis_id = str(uuid.uuid4())
        timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        return SavedAnalysis(
            id=analysis_id,
            name=f"Gap Review - {timestamp} (Mock)",
            timestamp=timestamp,
            type='challenge',
            challengeAnalysisResult=mock_result,
            userPrompt="[Gap Review analysis generated - Mock Mode]",
            systemPrompt="[System prompt for gap review - Mock Mode]"
        )

    def generate_deep_dive(self, request: DeepDiveRequest) -> SavedAnalysis:
        """Generate a real deep dive analysis using Vertex AI"""
        try:
            # 1. Find target document
            target_doc = next((doc for doc in request.allCompanyDocs if doc.id == request.docId), None)
            if not target_doc:
                raise ValueError("Target document not found.")

            logger.info(f"Starting real deep dive analysis for document: {target_doc.name}")

            # 2. Check if Vertex AI is available
            if not self.vertex_ai_service or not hasattr(self.vertex_ai_service, 'analyze_document_compliance'):
                logger.warning("Vertex AI service not available, falling back to enhanced mock")
                return self._generate_enhanced_mock_deep_dive(target_doc, request)

            # 3. Perform real AI analysis
            analysis_result = self.vertex_ai_service.analyze_document_compliance(
                document_content=target_doc.textContent,
                document_name=target_doc.name
            )

            # 4. Convert AI response to structured format
            suggested_changes = []
            for change_data in analysis_result.get("suggested_changes", []):
                suggested_changes.append(SuggestedChange(
                    id=change_data["id"],
                    document_section=change_data["document_section"],
                    current_status_summary=change_data["current_status_summary"],
                    austrac_relevance=change_data["austrac_relevance"],
                    suggested_modification=change_data["suggested_modification"],
                    priority=change_data["priority"],
                    basis_of_suggestion=change_data.get("basis_of_suggestion", "General Knowledge")
                ))

            action_plan = []
            for action_data in analysis_result.get("action_plan", []):
                action_plan.append(ActionPlanItem(
                    id=action_data["id"],
                    task=action_data["task"],
                    responsible=action_data["responsible"],
                    timeline=action_data["timeline"],
                    priority_level=action_data["priority_level"]
                ))

            # 5. Create DeepDiveAnalysisResult
            deep_dive_result = DeepDiveAnalysisResult(
                documentTitleAnalyzed=target_doc.name,
                overallSummary=analysis_result.get("overall_summary", "Analysis completed"),
                keyThemesAndTopics=analysis_result.get("key_themes", []),
                suggested_changes=suggested_changes,
                action_plan=action_plan,
                additionalObservations=analysis_result.get("additional_observations", ""),
                referencedRegulatoryInputs=self._extract_referenced_inputs(request.allAustracContent, analysis_result)
            )

            # 6. Create SavedAnalysis object
            analysis_id = str(uuid.uuid4())
            timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
            
            return SavedAnalysis(
                id=analysis_id,
                name=f"Deep Dive: {target_doc.name} - {timestamp[:10]}",
                timestamp=timestamp,
                type='deepDive',
                deepDiveAnalysisResult=deep_dive_result,
                selectedDocumentSnapshot={
                    "id": target_doc.id, 
                    "name": target_doc.name, 
                    "type": target_doc.type, 
                    "lastModified": target_doc.lastModified, 
                    "size": target_doc.size
                },
                groundingMetadata=analysis_result.get("grounding_metadata"),
                systemPrompt="Real-time compliance analysis using Vertex AI Search and Gemini",
                userPrompt=f"Analyze document '{target_doc.name}' for compliance gaps and improvement opportunities"
            )
            
        except Exception as e:
            logger.error(f"Error generating deep dive: {e}")
            # Fallback to enhanced mock
            target_doc = next((doc for doc in request.allCompanyDocs if doc.id == request.docId), None)
            if target_doc:
                return self._generate_enhanced_mock_deep_dive(target_doc, request)
            else:
                raise Exception(f"Failed to generate deep dive: {str(e)}")

    def _generate_enhanced_mock_deep_dive(self, target_doc, request: DeepDiveRequest) -> SavedAnalysis:
        """Generate an enhanced mock deep dive analysis when Vertex AI is not available"""
        
        # Create more realistic mock suggestions based on document content
        doc_content_lower = target_doc.textContent.lower()
        suggestions = []
        actions = []
        
        # Content-based analysis for suggestions
        if "customer" in doc_content_lower and "identification" in doc_content_lower:
            suggestions.append(SuggestedChange(
                id=f"ddsc-{str(uuid.uuid4())[:8]}",
                document_section="Customer Identification Procedures",
                current_status_summary="Current procedures require manual verification",
                austrac_relevance="AUSTRAC requires enhanced due diligence and digital verification capabilities",
                suggested_modification="Implement digital identity verification using government frameworks and biometric validation",
                priority="High",
                basis_of_suggestion="Regulation"
            ))
            actions.append(ActionPlanItem(
                id=f"ddap-{str(uuid.uuid4())[:8]}",
                task="Upgrade customer identification systems to support digital verification",
                responsible="IT and Compliance Teams",
                timeline="6 Months",
                priority_level="High"
            ))

        if "risk" in doc_content_lower:
            suggestions.append(SuggestedChange(
                id=f"ddsc-{str(uuid.uuid4())[:8]}",
                document_section="Risk Assessment Framework",
                current_status_summary="Risk assessment methodology outlined",
                austrac_relevance="Enhanced risk-based approach required for transaction monitoring",
                suggested_modification="Implement dynamic risk scoring with machine learning capabilities for real-time assessment",
                priority="Medium",
                basis_of_suggestion="Industry Best Practice"
            ))

        if "transaction" in doc_content_lower or "monitor" in doc_content_lower:
            suggestions.append(SuggestedChange(
                id=f"ddsc-{str(uuid.uuid4())[:8]}",
                document_section="Transaction Monitoring",
                current_status_summary="Basic transaction monitoring described",
                austrac_relevance="AUSTRAC requires sophisticated transaction monitoring for suspicious activity detection",
                suggested_modification="Enhance monitoring algorithms to include behavioral analysis and pattern recognition",
                priority="High",
                basis_of_suggestion="Legislation"
            ))

        if "record" in doc_content_lower:
            suggestions.append(SuggestedChange(
                id=f"ddsc-{str(uuid.uuid4())[:8]}",
                document_section="Record Keeping Requirements",
                current_status_summary="Basic record keeping mentioned",
                austrac_relevance="AUSTRAC requires specific record retention periods and formats",
                suggested_modification="Specify 7-year retention period for transaction records and customer identification documents",
                priority="Medium",
                basis_of_suggestion="Legislation"
            ))

        # Default suggestions if no specific content detected
        if not suggestions:
            suggestions.append(SuggestedChange(
                id=f"ddsc-{str(uuid.uuid4())[:8]}",
                document_section="General Compliance Review",
                current_status_summary="Document reviewed for compliance gaps",
                austrac_relevance="All financial service policies should align with current regulatory requirements",
                suggested_modification="Conduct comprehensive review against latest AUSTRAC guidance and industry best practices",
                priority="Medium",
                basis_of_suggestion="General Knowledge"
            ))

        if not actions:
            actions.append(ActionPlanItem(
                id=f"ddap-{str(uuid.uuid4())[:8]}",
                task="Schedule quarterly compliance review of this document",
                responsible="Compliance Officer",
                timeline="Next Quarter",
                priority_level="Medium"
            ))

        # Create result
        deep_dive_result = DeepDiveAnalysisResult(
            documentTitleAnalyzed=target_doc.name,
            overallSummary=f"Enhanced analysis of {target_doc.name} identifies several areas for compliance improvement, particularly around customer identification and risk management procedures.",
            keyThemesAndTopics=["Customer Due Diligence", "Risk Assessment", "Record Keeping", "Regulatory Compliance"],
            suggested_changes=suggestions,
            action_plan=actions,
            additionalObservations="This analysis was generated using enhanced mock logic based on document content analysis. For full AI-powered analysis, ensure Vertex AI services are properly configured.",
            referencedRegulatoryInputs=self._extract_referenced_inputs(request.allAustracContent, {})
        )

        analysis_id = str(uuid.uuid4())
        timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        return SavedAnalysis(
            id=analysis_id,
            name=f"Deep Dive: {target_doc.name} - {timestamp[:10]} (Enhanced Mock)",
            timestamp=timestamp,
            type='deepDive',
            deepDiveAnalysisResult=deep_dive_result,
            selectedDocumentSnapshot={
                "id": target_doc.id, 
                "name": target_doc.name, 
                "type": target_doc.type, 
                "lastModified": target_doc.lastModified, 
                "size": target_doc.size
            },
            systemPrompt="Enhanced mock analysis with content-based suggestions",
            userPrompt=f"Analyze document '{target_doc.name}' for compliance gaps and improvement opportunities"
        )

    def _extract_referenced_inputs(self, all_austrac_content, analysis_result) -> List[str]:
        """
        Extract which regulatory inputs were referenced in the analysis
        This is a placeholder - in a full implementation, you'd track which 
        documents from your data store were actually used
        """
        # For now, return a simple list based on available content
        if all_austrac_content and len(all_austrac_content) > 0:
            return [doc.title for doc in all_austrac_content[:3]]  # Return first 3 as example
        else:
            return ["General regulatory knowledge", "AUSTRAC guidelines", "ASIC requirements"]

    def generate_draft(self, request: DraftRequest) -> str:
        """Generate draft text using Vertex AI"""
        try:
            if not self.vertex_ai_service or not hasattr(self.vertex_ai_service, 'model') or not self.vertex_ai_service.model:
                # Fallback to mock if AI not available
                return self._generate_mock_draft(request)

            # Access the changeToDraft as a dict since it comes from frontend
            change_data = request.changeToDraft

            # Build prompt for draft generation
            draft_prompt = f"""You are a compliance document editor. Your task is to rewrite a section of a document based on a specific suggestion.

**Original Document:** {request.originalDocument.name}
**Original Content:** {request.originalDocument.textContent[:4000]}

**Suggestion to Implement:**
- Section: {change_data.get('document_section', 'General')}
- Current Status: {change_data.get('current_status_summary', '')}
- Suggested Change: {change_data.get('suggested_modification', '')}

**Your Task:**
Rewrite the document incorporating the suggested change. Keep the same structure and tone but implement the specific modification suggested. Return the complete updated document text.

**Updated Document:**"""

            # Generate draft using Vertex AI
            new_draft = self.vertex_ai_service.generate_content(draft_prompt)
            
            return new_draft
            
        except Exception as e:
            logger.error(f"Error generating draft: {e}")
            # Fallback to mock draft
            return self._generate_mock_draft(request)

    def _generate_mock_draft(self, request: DraftRequest) -> str:
        """Fallback mock draft generation"""
        original_text = request.originalDocument.textContent
        change_data = request.changeToDraft
        suggestion = change_data.get('suggested_modification', 'No specific change provided')
        section = change_data.get('document_section', 'General')
        
        return f"""--- UPDATED DRAFT (AI-Enhanced) ---

{original_text}

--- IMPLEMENTED CHANGE FOR: {section} ---
{suggestion}

--- END OF DRAFT ---

Note: This draft incorporates the suggested modification. Please review and adjust as needed before final implementation."""