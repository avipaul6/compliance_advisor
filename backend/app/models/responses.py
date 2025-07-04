from pydantic import BaseModel
from typing import List, Optional, Dict, Literal

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

class ChallengeAnalysisResult(BaseModel):
    suggested_changes: List[SuggestedChange]
    action_plan: List[ActionPlanItem]
    groupedSuggestions: Optional[Dict[str, List[SuggestedChange]]] = None

class DeepDiveAnalysisResult(BaseModel):
    documentTitleAnalyzed: str
    overallSummary: str
    keyThemesAndTopics: List[str]
    suggested_changes: List[SuggestedChange]
    action_plan: List[ActionPlanItem]
    additionalObservations: Optional[str] = None
    referencedRegulatoryInputs: Optional[List[str]] = None

class GroundingChunkWeb(BaseModel):
    uri: Optional[str] = None
    title: Optional[str] = None

class GroundingChunk(BaseModel):
    web: Optional[GroundingChunkWeb] = None
    
class GroundingMetadata(BaseModel):
    groundingChunks: Optional[List[GroundingChunk]] = None

class SavedAnalysis(BaseModel):
    id: str
    name: str
    timestamp: str
    type: Literal['challenge', 'deepDive']
    challengeAnalysisResult: Optional[ChallengeAnalysisResult] = None
    austracInputsUsedSnapshot: Optional[List[Dict]] = None
    companyDocumentsUsedSnapshot: Optional[List[Dict]] = None
    summarizedAustracUpdatesSnapshot: Optional[List[Dict]] = None
    learningsAppliedToThisAnalysis: Optional[List[str]] = None
    selectedDocumentSnapshot: Optional[Dict] = None
    deepDiveAnalysisResult: Optional[DeepDiveAnalysisResult] = None
    groundingMetadata: Optional[GroundingMetadata] = None
    userPrompt: Optional[str] = None
    systemPrompt: Optional[str] = None

class IngestResponse(BaseModel):
    success: bool
    message: str

class ChatResponse(BaseModel):
    text: str
    grounding: Optional[GroundingMetadata] = None
    retrievedContext: Optional[List[Dict]] = None

class DraftResponse(BaseModel):
    newDraft: str