// This service now acts as an API client for the Python backend.
// All interactions with Vertex AI are expected to be handled by the backend.

import { 
    AustracUpdate, CompanyDocument, DocumentChunk, SuggestedChange, SavedAnalysis, 
    GroundingMetadata 
} from './types';

// Your Python backend's base URL.
// For local development, this is likely http://localhost:8000 or http://127.0.0.1:8000
const API_BASE_URL = '/api/v1';

// Helper function for making API calls to the Python backend
async function fetchFromApi<T>(endpoint: string, options: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
    try {
      // Try to parse a structured error message from the backend
      const errorBody = await response.json();
      errorMessage = errorBody.detail || JSON.stringify(errorBody) || errorMessage;
    } catch (e) {
      // Could not parse error body, use the original status text.
    }
    throw new Error(errorMessage);
  }

  // Handle cases where the backend might return an empty response (e.g., HTTP 204)
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return response.json() as Promise<T>;
  } else {
    // If not JSON, we can return an empty object or handle as needed
    return Promise.resolve(undefined as unknown as T);
  }
}


/**
 * Sends a batch of documents to the backend for ingestion into the vector database.
 * @param documents - An array of CompanyDocument or AustracUpdate objects.
 * @returns A promise with the result of the ingestion task.
 */
export const ingestDocumentsInBackend = async (
  documents: (CompanyDocument | AustracUpdate)[]
): Promise<{ success: boolean; message: string }> => {
  console.log(`[API Service] Sending ${documents.length} documents to backend for ingestion.`);
  
  const payload = {
    documents: documents.map(doc => ({
      id: doc.id,
      content: 'rawContent' in doc ? doc.rawContent : doc.textContent,
      metadata: {
          name: 'name' in doc ? doc.name : doc.title,
          type: 'rawContent' in doc ? 'austrac' : 'company',
          // Include any other metadata your Python backend needs for ingestion
          size: 'size' in doc ? doc.size : doc.rawContent.length,
          lastModified: 'lastModified' in doc ? doc.lastModified : new Date(doc.dateAdded).getTime()
      }
    }))
  };

  return fetchFromApi<{ success: boolean; message: string }>('/documents/ingest', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};


/**
 * Requests the backend to perform a Gap Review analysis.
 * The backend is responsible for all logic, including RAG, prompting, and calling Gemini.
 * @param payload - The data needed for the backend to run the analysis.
 * @returns A promise that resolves to a complete SavedAnalysis object.
 */
export const generateGapReviewInBackend = async (payload: {
    targetRegulatoryIds: string[],
    companyDocIds: string[],
    allAustracContent: AustracUpdate[],
    allCompanyDocs: CompanyDocument[],
    savedAnalyses: SavedAnalysis[]
}): Promise<SavedAnalysis> => {
    console.log('[API Service] Requesting Gap Review from backend.');
    return fetchFromApi<SavedAnalysis>('/analysis/generate/gap-review', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
};


/**
 * Requests the backend to perform a Deep Dive analysis on a single document.
 * @param payload - The data needed for the backend to run the analysis.
 * @returns A promise that resolves to a complete SavedAnalysis object.
 */
export const generateDeepDiveInBackend = async (payload: {
    docId: string,
    allCompanyDocs: CompanyDocument[],
    allAustracContent: AustracUpdate[]
}): Promise<SavedAnalysis> => {
    console.log('[API Service] Requesting Deep Dive from backend.');
    return fetchFromApi<SavedAnalysis>('/analysis/generate/deep-dive', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
};

/**
 * Sends a chat message to the backend and gets a response.
 * The backend manages the chat history context and calls the AI.
 * @param payload - The current message, history, and broader application context.
 * @returns A promise that resolves to the AI's response.
 */
export const sendChatMessageToBackend = async (payload: {
  message: string,
  history: { sender: 'user' | 'model', text: string }[],
  context: {
    allCompanyDocs: CompanyDocument[],
    allAustracContent: AustracUpdate[],
    savedAnalyses: SavedAnalysis[],
    activeAnalysisId: string | null
  }
}): Promise<{ text: string, grounding?: GroundingMetadata, retrievedContext?: DocumentChunk[] }> => {
    console.log('[API Service] Sending chat message to backend.');
    return fetchFromApi<{ text: string, grounding?: GroundingMetadata, retrievedContext?: DocumentChunk[] }>('/chat/chat', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
};


/**
 * Requests the backend to generate a rewritten text draft based on a suggestion.
 * @param payload - The suggested change and the original document to modify.
 * @returns A promise that resolves to the newly drafted text.
 */
export const generateDraftInBackend = async (payload: {
  changeToDraft: SuggestedChange,
  originalDocument: CompanyDocument
}): Promise<{ newDraft: string }> => {
    console.log('[API Service] Requesting draft text from backend.');
    return fetchFromApi<{ newDraft: string }>('/analysis/generate/draft', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
};