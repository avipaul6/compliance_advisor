# main.py - Your Python Backend Server
import os
import uuid
import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Literal, Union

# --- Pydantic Models (Data Contracts with Frontend) ---
# These models ensure that the data sent from your React app
# matches the structure the backend expects. FastAPI uses them
# for automatic validation and documentation.

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

class DeepDiveRequest(BaseModel):
    docId: str
    allCompanyDocs: List[CompanyDocument]
    allAustracContent: List[AustracUpdate]

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


# --- FastAPI Application Setup ---
app = FastAPI()

# IMPORTANT: This enables CORS to allow your React frontend (running on a different port)
# to communicate with this Python backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


# --- API Endpoints ---

@app.get("/api")
def read_root():
    return {"message": "Vera: Virtual Regulation Assistant Backend is running!"}

@app.post("/api/ingest")
async def ingest_documents(request: IngestRequest):
    """
    Placeholder for document ingestion logic.
    In a real app, this is where you would chunk the documents and
    add them to a Vertex AI Search vector database.
    """
    num_docs = len(request.documents)
    print(f"Received {num_docs} documents for ingestion.")
    
    # TODO: Implement actual ingestion logic here.
    # 1. Connect to your Vertex AI Search client.
    # 2. For each document in `request.documents`:
    #    a. Chunk the `doc.content`.
    #    b. Create embeddings for each chunk.
    #    c. Upsert the chunks and embeddings to your vector store.
    
    return {"success": True, "message": f"Successfully processed {num_docs} documents on the backend."}


@app.post("/api/generate/gap-review", response_model=SavedAnalysis)
async def generate_gap_review(request: GapReviewRequest):
    """
    Placeholder for the main Gap Review generation logic.
    This simulates receiving document IDs, generating prompts,
    calling Gemini, parsing the response, and returning a structured result.
    """
    print("Generating Gap Review...")
    target_docs = [doc for doc in request.allCompanyDocs if doc.id in request.companyDocIds]
    target_regs = [reg for reg in request.allAustracContent if reg.id in request.targetRegulatoryIds]

    if not target_docs or not target_regs:
        raise HTTPException(status_code=400, detail="Missing company documents or regulatory inputs.")

    # TODO: Implement the real Gap Review logic with Vertex AI Gemini.
    # 1. Construct a detailed system prompt for the task.
    # 2. Construct a user prompt containing the text content of the selected documents.
    # 3. Call the Gemini model (`gemini-1.5-pro-preview-0409` or similar).
    # 4. Request a JSON response from the model.
    # 5. Parse the model's response into the `ChallengeAnalysisResult` structure.

    # --- MOCK DATA ---
    # This is placeholder data that mimics a real AI response.
    # Replace this with the actual response from Gemini.
    mock_change_id = str(uuid.uuid4())
    mock_action_id = str(uuid.uuid4())
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
                id=f"grap-{mock_action_id}",
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
    new_saved_analysis = SavedAnalysis(
        id=analysis_id,
        name=f"Gap Review - {timestamp}",
        timestamp=timestamp,
        type='challenge',
        challengeAnalysisResult=mock_result,
        companyDocumentsUsedSnapshot=[{"id": d.id, "name": d.name} for d in target_docs],
        austracInputsUsedSnapshot=[{"id": r.id, "title": r.title} for r in target_regs],
        userPrompt="[This is a mock user prompt. In a real app, this would contain the document contents.]",
        systemPrompt="[This is a mock system prompt. In a real app, this would contain instructions for the AI.]"
    )
    
    return new_saved_analysis

@app.post("/api/generate/deep-dive", response_model=SavedAnalysis)
async def generate_deep_dive(request: DeepDiveRequest):
    """
    Placeholder for the Document Deep Dive generation logic.
    """
    print(f"Generating Deep Dive for doc ID: {request.docId}")
    target_doc = next((doc for doc in request.allCompanyDocs if doc.id == request.docId), None)

    if not target_doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # TODO: Implement real Deep Dive logic with Vertex AI Gemini and Google Search.
    # 1. Create a system prompt for in-depth document analysis.
    # 2. Create a user prompt with the document's text.
    # 3. Use the `tools` parameter in your Gemini call to enable Google Search grounding.
    # 4. Call the Gemini model.
    # 5. Extract the text response and the grounding metadata (web sources).
    # 6. Parse the response into the DeepDiveAnalysisResult structure.
    
    # --- MOCK DATA ---
    mock_result = DeepDiveAnalysisResult(
        documentTitleAnalyzed=target_doc.name,
        overallSummary="This document is well-structured but could be enhanced with clearer definitions and examples related to sanctions screening.",
        keyThemesAndTopics=["Onboarding", "Risk Assessment", "Sanctions Screening"],
        suggested_changes=[
            SuggestedChange(
                id=f"ddsc-{uuid.uuid4()}",
                document_section="Appendix A: Definitions",
                current_status_summary="The definition for 'PEP' is outdated.",
                austrac_relevance="Aligns with international standards for Politicaly Exposed Persons.",
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
        referencedRegulatoryInputs=["Sample AUSTRAC Guidance Note.pdf"]
    )

    mock_grounding = GroundingMetadata(
        groundingChunks=[
            GroundingChunk(web=GroundingChunkWeb(uri="https://www.austrac.gov.au/business/core-guidance/customer-identification-and-verification", title="AUSTRAC - Customer Identification"))
        ]
    )

    analysis_id = str(uuid.uuid4())
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    new_saved_analysis = SavedAnalysis(
        id=analysis_id,
        name=f"Deep Dive on {target_doc.name}",
        timestamp=timestamp,
        type='deepDive',
        deepDiveAnalysisResult=mock_result,
        selectedDocumentSnapshot={"id": target_doc.id, "name": target_doc.name},
        groundingMetadata=mock_grounding,
        userPrompt="[Mock User Prompt for Deep Dive]",
        systemPrompt="[Mock System Prompt for Deep Dive]"
    )

    return new_saved_analysis


@app.post("/api/chat")
async def chat_with_bot(request: ChatRequest):
    """
    Placeholder for the chatbot logic.
    """
    print(f"Received chat message: {request.message}")

    # TODO: Implement real chat logic.
    # 1. Build context from the request (documents, history, etc.).
    # 2. Use a RAG approach:
    #    a. Create an embedding for the user's message (`request.message`).
    #    b. Query your vector database to find relevant document chunks.
    # 3. Construct a prompt that includes the chat history, the user's message, and the retrieved chunks.
    # 4. Call the Gemini model.
    # 5. Return the model's text response.
    
    # --- MOCK RESPONSE ---
    mock_response = {
        "text": f"This is a mock response to your question: '{request.message}'. In a real application, I would use RAG to search the provided documents and give a detailed answer.",
    }
    return mock_response


@app.post("/api/generate/draft")
async def generate_draft(request: DraftRequest):
    """
    Placeholder for generating a rewritten document draft.
    """
    print(f"Generating draft for change in '{request.changeToDraft.document_section}'")

    # TODO: Implement real draft generation logic.
    # 1. Create a prompt that includes:
    #    a. The original document text (`request.originalDocument.textContent`).
    #    b. The specific change to be made (`request.changeToDraft`).
    # 2. Instruct the model to rewrite the *entire document* incorporating the change seamlessly.
    # 3. Call the Gemini model.
    # 4. Return the full rewritten text.
    
    # --- MOCK RESPONSE ---
    original_text = request.originalDocument.textContent
    suggestion = request.changeToDraft.suggested_modification
    
    new_draft = f"--- THIS IS A MOCK DRAFT ---\n\n"
    new_draft += f"The following AI-generated text incorporates the suggestion: '{suggestion}'.\n\n"
    new_draft += "--- START OF MODIFIED DOCUMENT ---\n\n"
    new_draft += f"{original_text}\n\n... and furthermore, based on the suggestion, we have added this new paragraph: '{suggestion}'. This concludes the updated section.\n\n"
    new_draft += "--- END OF MODIFIED DOCUMENT ---"

    return {"newDraft": new_draft}