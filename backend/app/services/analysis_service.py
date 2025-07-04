import uuid
import datetime
from app.models.requests import GapReviewRequest, DeepDiveRequest, DraftRequest
from app.models.responses import (
    SavedAnalysis, ChallengeAnalysisResult, DeepDiveAnalysisResult,
    SuggestedChange, ActionPlanItem
)
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

class AnalysisService:
    
    def generate_gap_review(self, request: GapReviewRequest) -> SavedAnalysis:
        """Generate a gap review analysis (currently mock)"""
        try:
            target_docs = [doc for doc in request.allCompanyDocs if doc.id in request.companyDocIds]
            if not target_docs:
                raise ValueError("Missing company documents.")
                
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
                name=f"Mock Gap Review - {timestamp}",
                timestamp=timestamp,
                type='challenge',
                challengeAnalysisResult=mock_result,
                userPrompt="[This was a mock generation]",
                systemPrompt="[This was a mock generation]"
            )
            
        except Exception as e:
            logger.error(f"Error generating gap review: {e}")
            raise Exception(f"Failed to generate gap review: {str(e)}")

    def generate_deep_dive(self, request: DeepDiveRequest) -> SavedAnalysis:
        """Generate a deep dive analysis (currently mock)"""
        try:
            target_doc = next((doc for doc in request.allCompanyDocs if doc.id == request.docId), None)
            if not target_doc:
                raise ValueError("Target document not found.")

            mock_result = DeepDiveAnalysisResult(
                documentTitleAnalyzed=target_doc.name,
                overallSummary="This document is well-structured but could be enhanced with clearer definitions for sanctions screening.",
                keyThemesAndTopics=["Onboarding", "Risk Assessment", "Sanctions Screening"],
                suggested_changes=[
                    SuggestedChange(
                        id=f"ddsc-{uuid.uuid4()}",
                        document_section="Appendix A: Definitions",
                        current_status_summary="The definition for 'PEP' is outdated.",
                        austrac_relevance="Aligns with international standards for Politically Exposed Persons.",
                        suggested_modification="Update the definition of 'Politically Exposed Person (PEP)' to match the latest FATF guidance.",
                        priority='Medium'
                    )
                ],
                action_plan=[
                    ActionPlanItem(
                        id=f"ddap-{uuid.uuid4()}",
                        task="Schedule a review of all definitions in the glossary.",
                        responsible="Legal & Compliance",
                        timeline="Next Quarter",
                        priority_level='Low'
                    )
                ],
            )
            
            analysis_id = str(uuid.uuid4())
            timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
            
            return SavedAnalysis(
                id=analysis_id,
                name=f"Mock Deep Dive on {target_doc.name}",
                timestamp=timestamp,
                type='deepDive',
                deepDiveAnalysisResult=mock_result,
                selectedDocumentSnapshot={
                    "id": target_doc.id, 
                    "name": target_doc.name, 
                    "type": "pdf", 
                    "lastModified": 0, 
                    "size": 0
                },
            )
            
        except Exception as e:
            logger.error(f"Error generating deep dive: {e}")
            raise Exception(f"Failed to generate deep dive: {str(e)}")

    def generate_draft(self, request: DraftRequest) -> str:
        """Generate draft text (currently mock)"""
        try:
            original_text = request.originalDocument.textContent
            suggestion = request.changeToDraft.suggested_modification
            
            new_draft = f"--- THIS IS A MOCK DRAFT ---\n\n{original_text}\n\n... and furthermore, based on the suggestion, we have added this new paragraph: '{suggestion}'.\n\n--- END OF DRAFT ---"
            
            return new_draft
            
        except Exception as e:
            logger.error(f"Error generating draft: {e}")
            raise Exception(f"Failed to generate draft: {str(e)}")