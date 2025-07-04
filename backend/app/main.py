# main.py - Your Python Backend Server with real Vertex AI Integration
import os
import uuid
import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Literal

import vertexai
from vertexai.generative_models import GenerativeModel

# Use the correct client for Vertex AI Search, which is in the discoveryengine library
from google.cloud import discoveryengine_v1 as discoveryengine

# --- TODO: PLEASE CONFIGURE THESE VALUES ---
# Fill in your Google Cloud project details here.
PROJECT_ID = "your-gcp-project-id"  # <-- Your Google Cloud Project ID
LOCATION = "global"                 # For Discovery Engine, this is usually "global" or "us"
DATA_STORE_ID = "your-vertex-ai-search-data-store-id" # <-- Your Vertex AI Search Data Store ID
# --- END OF CONFIGURATION ---


# --- Vertex AI Clients ---
# Initialize Vertex AI SDK for Gemini - Use a region that supports the model
vertexai.init(project=PROJECT_ID, location="us-central1") 

# Initialize the Gemini model - Upgraded to flash as requested
model = GenerativeModel("gemini-2.5-flash-preview-04-17") 

# Initialize the Vertex AI Search (Discovery Engine) client
search_client = discoveryengine.SearchServiceClient()

# Construct the serving_config_path - THIS IS THE FIX.
# The 'collection' argument is not used here.
serving_config_path = search_client.serving_config_path(
    project=PROJECT_ID,
    location=LOCATION,
    data_store=DATA_STORE_ID,
    serving_config="default_config",
)


# --- Pydantic Models (Data Contracts with Frontend) ---
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
    summarizedAustracUpdatesSnapshot: Optional[List[AustracUpdate]] = None
    learningsAppliedToThisAnalysis: Optional[List[str]] = None
    selectedDocumentSnapshot: Optional[Dict] = None
    deepDiveAnalysisResult: Optional[DeepDiveAnalysisResult] = None
    groundingMetadata: Optional[GroundingMetadata] = None
    userPrompt: Optional[str] = None
    systemPrompt: Optional[str] = None

class GapReviewRequest(BaseModel):
    targetRegulatoryIds: List[str]
    companyDocIds: List[str]
    allAustracContent: List[AustracUpdate]
    allCompanyDocs: List[CompanyDocument]
    savedAnalyses: List[SavedAnalysis]

class ChatMessage(BaseModel):
    sender: str
    text: str

class ChatContext(BaseModel):
    allCompanyDocs: List[CompanyDocument]
    allAustracContent: List[AustracUpdate]
    savedAnalyses: List[SavedAnalysis]
    activeAnalysisId: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage]
    context: ChatContext

class DraftRequest(BaseModel):
    changeToDraft: SuggestedChange
    originalDocument: CompanyDocument

class DeepDiveRequest(BaseModel):
    docId: str
    allCompanyDocs: List[CompanyDocument]
    allAustracContent: List[AustracUpdate]

# --- FastAPI Application Setup ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- API Endpoints ---
@app.get("/api")
def read_root():
    return {"message": "Vera: Virtual Regulation Assistant Backend is running!"}


@app.post("/api/ingest")
async def ingest_documents(request: IngestRequest):
    num_docs = len(request.documents)
    print(f"Received {num_docs} documents for simulated ingestion.")
    return {"success": True, "message": f"Backend acknowledged {num_docs} documents. In a real app, they would be processed by Vertex AI Search."}


@app.post("/api/chat")
async def chat_with_bot(request: ChatRequest):
    print(f"Received chat message: {request.message}")

    try:
        # 1. Search Vertex AI Search (The "R" in RAG)
        search_request = discoveryengine.SearchRequest(
            serving_config=serving_config_path,
            query=request.message,
            page_size=5,
            content_search_spec=discoveryengine.SearchRequest.ContentSearchSpec(
                snippet_spec=discoveryengine.SearchRequest.ContentSearchSpec.SnippetSpec(
                    return_snippet=True
                ),
                summary_spec=discoveryengine.SearchRequest.ContentSearchSpec.SummarySpec(
                    summary_result_count=5,
                    include_citations=True,
                ),
            ),
        )
        search_response = search_client.search(search_request)
        
        context_str = search_response.summary.summary_text
        
        # 2. Construct Prompt for Generation (The "G" in RAG)
        chat_history_formatted = "\n".join(
            [f"{msg.sender}: {msg.text}" for msg in request.history]
        )
        
        prompt = f"""You are a compliance assistant chatbot named Vera. Your purpose is to help answer questions based on the user's uploaded documents.
        
        Use the following summary of retrieved document chunks to answer the user's question. If the context does not contain the answer, state that you could not find the information in the provided documents. Do not make up information. Always cite your sources using the format [number] from the summary.

        **Retrieved Context Summary:**
        {context_str}
        
        **Chat History:**
        {chat_history_formatted}

        **User's new question:** {request.message}
        
        **Your Answer:**
        """

        # 3. Call Gemini
        response = model.generate_content(prompt)
        
        return {"text": response.text}

    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate/gap-review", response_model=SavedAnalysis)
async def generate_gap_review(request: GapReviewRequest):
    print("Generating Mock Gap Review...")
    target_docs = [doc for doc in request.allCompanyDocs if doc.id in request.companyDocIds]
    if not target_docs:
        raise HTTPException(status_code=400, detail="Missing company documents.")
        
    mock_change_id = str(uuid.uuid4())
    doc_name = target_docs[0].name
    
    mock_result = ChallengeAnalysisResult(
        suggested_changes=[
            SuggestedChange(id=f"grsc-{mock_change_id}",document_section="Section 3.1: Customer Identification",current_status_summary="The current policy requires two forms of ID for verification.",austrac_relevance="The new AUSTRAC guidance emphasizes the need for digital identity verification methods.",suggested_modification="Incorporate a new sub-section for verifying customers using the Australian Government's Digital Identity Framework.",priority="High",source_document_name=doc_name)
        ],
        action_plan=[ActionPlanItem(id=f"grap-{uuid.uuid4()}",task="Develop a new procedure for digital identity verification.",responsible="Compliance Team Lead",timeline="3 Months",priority_level="High")],
        groupedSuggestions={doc_name: [SuggestedChange(id=f"grsc-{mock_change_id}",document_section="Section 3.1: Customer Identification",current_status_summary="The current policy requires two forms of ID for verification.",austrac_relevance="The new AUSTRAC guidance emphasizes the need for digital identity verification methods.",suggested_modification="Incorporate a new sub-section for verifying customers using the Australian Government's Digital Identity Framework.",priority="High",source_document_name=doc_name)]}
    )
    
    analysis_id = str(uuid.uuid4())
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    new_saved_analysis = SavedAnalysis(
        id=analysis_id,
        name=f"Mock Gap Review - {timestamp}",
        timestamp=timestamp,
        type='challenge',
        challengeAnalysisResult=mock_result,
        userPrompt="[This was a mock generation]",
        systemPrompt="[This was a mock generation]"
    )
    
    return new_saved_analysis

@app.post("/api/generate/deep-dive", response_model=SavedAnalysis)
async def generate_deep_dive(request: DeepDiveRequest):
    print(f"Generating Deep Dive for doc ID: {request.docId}")
    target_doc = next((doc for doc in request.allCompanyDocs if doc.id == request.docId), None)
    if not target_doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    mock_result = DeepDiveAnalysisResult(
        documentTitleAnalyzed=target_doc.name,
        overallSummary="This document is well-structured but could be enhanced with clearer definitions for sanctions screening.",
        keyThemesAndTopics=["Onboarding", "Risk Assessment", "Sanctions Screening"],
        suggested_changes=[SuggestedChange(id=f"ddsc-{uuid.uuid4()}",document_section="Appendix A: Definitions",current_status_summary="The definition for 'PEP' is outdated.",austrac_relevance="Aligns with international standards for Politically Exposed Persons.",suggested_modification="Update the definition of 'Politically Exposed Person (PEP)' to match the latest FATF guidance.",priority='Medium')],
        action_plan=[ActionPlanItem(id=f"ddap-{uuid.uuid4()}",task="Schedule a review of all definitions in the glossary.",responsible="Legal & Compliance",timeline="Next Quarter",priority_level='Low')],
    )
    analysis_id = str(uuid.uuid4())
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    new_saved_analysis = SavedAnalysis(
        id=analysis_id,
        name=f"Mock Deep Dive on {target_doc.name}",
        timestamp=timestamp,
        type='deepDive',
        deepDiveAnalysisResult=mock_result,
        selectedDocumentSnapshot={"id": target_doc.id, "name": target_doc.name, "type": "pdf", "lastModified": 0, "size": 0},
    )
    return new_saved_analysis

@app.post("/api/generate/draft")
async def generate_draft(request: DraftRequest):
    print(f"Generating draft for change in '{request.changeToDraft.document_section}'")
    original_text = request.originalDocument.textContent
    suggestion = request.changeToDraft.suggested_modification
    new_draft = f"--- THIS IS A MOCK DRAFT ---\n\n{original_text}\n\n... and furthermore, based on the suggestion, we have added this new paragraph: '{suggestion}'.\n\n--- END OF DRAFT ---"
    return {"newDraft": new_draft}