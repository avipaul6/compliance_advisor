# backend/app/models/analysis_models.py
"""
Analysis Models - Consolidated models for analysis operations
Consolidates the analysis-related models from requests.py and responses.py
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Literal

# Base document models
class CompanyDocument(BaseModel):
    id: str
    name: str
    type: str
    textContent: str
    lastModified: int
    size: int
    isProcessedForRag: Optional[bool] = False

class AustracUpdate(BaseModel):
    id: str
    title: str
    rawContent: str
    type: Literal['pdf', 'txt', 'pasted']
    dateAdded: str
    isProcessedForRag: Optional[bool] = False

# Analysis request models
class GapReviewRequest(BaseModel):
    targetRegulatoryIds: List[str] = Field(alias="selectedTargetIds", default=[])
    companyDocIds: List[str] = Field(default=[])
    companyDocuments: List[CompanyDocument] = Field(default=[])
    allAustracContent: List[AustracUpdate] = Field(default=[])
    allCompanyDocs: List[CompanyDocument] = Field(default=[])
    savedAnalyses: List[Dict] = Field(default=[])

    class Config:
        allow_population_by_field_name = True

class DeepDiveRequest(BaseModel):
    targetDocumentId: str = Field(alias="docId")
    companyDocuments: List[CompanyDocument] = Field(default=[])
    allCompanyDocs: List[CompanyDocument] = Field(default=[])
    allAustracContent: List[AustracUpdate] = Field(default=[])

    class Config:
        allow_population_by_field_name = True

# Analysis response models
class UserFeedback(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    lastUpdated: str
    finalAdoptedText: Optional[str] = None

class SuggestedChange(BaseModel):
    id: str
    document_section: str
    current_status_summary: str
    austrac_relevance: str
    suggested_modification: str
    priority: Literal['High', 'Medium', 'Low']
    userFeedback: Optional[UserFeedback] = None
    source_document_name: Optional[str] = None
    basis_of_suggestion: Optional[str] = None
    web_reference_keywords: Optional[List[str]] = None

class ActionPlanItem(BaseModel):
    id: str
    task: str
    responsible: str
    timeline: str
    priority_level: Literal['High', 'Medium', 'Low']
    userFeedback: Optional[UserFeedback] = None
    basis_of_suggestion: Optional[str] = None

class GapReviewResult(BaseModel):
    """Result from gap review analysis"""
    overall_summary: str
    key_themes_and_topics: List[str]
    suggested_changes: List[SuggestedChange]
    action_plan: List[ActionPlanItem]
    additional_observations: Optional[str] = None
    referenced_regulatory_inputs: Optional[List[str]] = None

class DeepDiveAnalysisResult(BaseModel):
    documentTitleAnalyzed: str
    overallSummary: str
    keyThemesAndTopics: List[str]
    suggested_changes: List[SuggestedChange]
    action_plan: List[ActionPlanItem]
    additionalObservations: Optional[str] = None
    referencedRegulatoryInputs: Optional[List[str]] = None

class ChallengeAnalysisResult(BaseModel):
    """Legacy alias for GapReviewResult to maintain compatibility"""
    suggested_changes: List[SuggestedChange]
    action_plan: List[ActionPlanItem]
    groupedSuggestions: Optional[Dict[str, List[SuggestedChange]]] = None

# Grounding and metadata models
class GroundingChunkWeb(BaseModel):
    uri: Optional[str] = None
    title: Optional[str] = None

class GroundingChunk(BaseModel):
    web: Optional[GroundingChunkWeb] = None
    
class GroundingMetadata(BaseModel):
    groundingChunks: Optional[List[GroundingChunk]] = None

# Saved analysis model
class SavedAnalysis(BaseModel):
    id: str
    name: str
    timestamp: str
    type: Literal['challenge', 'deepDive', 'gap_review']
    challengeAnalysisResult: Optional[ChallengeAnalysisResult] = None
    deepDiveAnalysisResult: Optional[DeepDiveAnalysisResult] = None
    gapReviewResult: Optional[GapReviewResult] = None
    austracInputsUsedSnapshot: Optional[List[Dict]] = None
    companyDocumentsUsedSnapshot: Optional[List[Dict]] = None
    summarizedAustracUpdatesSnapshot: Optional[List[Dict]] = None
    learningsAppliedToThisAnalysis: Optional[List[str]] = None
    selectedDocumentSnapshot: Optional[Dict] = None
    groundingMetadata: Optional[GroundingMetadata] = None
    userPrompt: Optional[str] = None
    systemPrompt: Optional[str] = None

# Chat models
class ChatMessage(BaseModel):
    sender: str
    text: str

class ChatContext(BaseModel):
    allCompanyDocs: List[CompanyDocument]
    allAustracContent: List[AustracUpdate]
    savedAnalyses: List[Dict]
    activeAnalysisId: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage]
    context: ChatContext

class ChatResponse(BaseModel):
    text: str
    grounding: Optional[GroundingMetadata] = None
    retrievedContext: Optional[List[Dict]] = None

# Document processing models
class DocumentMetadata(BaseModel):
    name: str
    type: str
    size: int
    lastModified: int

class IngestRequestDocument(BaseModel):
    id: str
    content: str
    metadata: DocumentMetadata

class IngestRequest(BaseModel):
    documents: List[IngestRequestDocument]

class IngestResponse(BaseModel):
    success: bool
    message: str

# Draft generation models
class DraftRequest(BaseModel):
    changeToDraft: Dict  # SuggestedChange
    originalDocument: CompanyDocument

class DraftResponse(BaseModel):
    newDraft: str