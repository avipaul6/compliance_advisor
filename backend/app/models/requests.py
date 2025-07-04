from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Literal

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

class AustracUpdate(BaseModel):
    id: str
    title: str
    rawContent: str
    type: Literal['pdf', 'txt', 'pasted']
    dateAdded: str
    isProcessedForRag: Optional[bool] = False

class CompanyDocument(BaseModel):
    id: str
    name: str
    type: str
    textContent: str
    lastModified: int
    size: int
    isProcessedForRag: Optional[bool] = False

class ChatMessage(BaseModel):
    sender: str
    text: str

class ChatContext(BaseModel):
    allCompanyDocs: List[CompanyDocument]
    allAustracContent: List[AustracUpdate]
    savedAnalyses: List[Dict]  # We'll define SavedAnalysis later
    activeAnalysisId: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage]
    context: ChatContext

class GapReviewRequest(BaseModel):
    targetRegulatoryIds: List[str]
    companyDocIds: List[str]
    allAustracContent: List[AustracUpdate]
    allCompanyDocs: List[CompanyDocument]
    savedAnalyses: List[Dict]

class DeepDiveRequest(BaseModel):
    docId: str
    allCompanyDocs: List[CompanyDocument]
    allAustracContent: List[AustracUpdate]

class DraftRequest(BaseModel):
    changeToDraft: Dict  # SuggestedChange
    originalDocument: CompanyDocument