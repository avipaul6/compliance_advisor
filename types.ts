





export interface UserFeedback {
  status?: string;
  notes?: string;
  lastUpdated: string; // ISO string
  finalAdoptedText?: string; // User's finalized version of the text for a SuggestedChange or SuggestedEnhancement
}

export interface AustracUpdate {
  id: string; // unique identifier
  title: string; // filename or user-input title for pasted text
  rawContent: string;
  type: 'pdf' | 'txt' | 'pasted'; // Source type
  dateAdded: string; // ISO string of when it was added/uploaded
  summary?: string; // AI-generated summary

  // Optional fields from original mock, user might not provide these for uploaded/pasted content
  date?: string; 
  sourceUrl?: string;

  // RAG processing status - true if ingested into Vertex AI RAG (simulated)
  isProcessedForRag?: boolean;
  // Consider adding a flag for "isPrimaryLegislation" in a future enhancement
}

export interface CompanyDocument { 
  id: string;
  name: string;
  // type: 'Policy' | 'Program' | 'Procedure'; // Original, more specific type
  type: 'pdf' | 'txt' | 'generic' | 'Policy' | 'Program' | 'Procedure'; // Broader type for uploaded files
  // excerpt: string; // Original, from mock
  // lastReviewed: string; // Original, from mock
  textContent: string; // Added for uploaded file content
  lastModified: number; // Added for uploaded file info
  size: number; // Added for uploaded file info

  // RAG processing status - true if ingested into Vertex AI RAG (simulated)
  isProcessedForRag?: boolean;
}


export interface SuggestedChange {
  id: string; // Unique ID for this specific suggestion
  document_section: string;
  current_status_summary: string;
  austrac_relevance: string;
  suggested_modification: string;
  priority: 'High' | 'Medium' | 'Low';
  userFeedback?: UserFeedback;
  source_document_name?: string; // The name of the source document this change applies to.
  // Deep Dive specific fields that are now merged in
  basis_of_suggestion?: 'Legislation' | 'Web Search' | 'Legislation & Web Search' | 'General Knowledge';
  web_reference_keywords?: string[];
}

export interface ActionPlanItem {
  id: string; // Unique ID for this specific action item
  task: string;
  responsible: string;
  timeline: string;
  priority_level: 'High' | 'Medium' | 'Low';
  userFeedback?: UserFeedback;
    // Deep Dive specific fields that are now merged in
  basis_of_suggestion?: 'Legislation' | 'Web Search' | 'Legislation & Web Search' | 'General Knowledge';
}

export interface ChallengeAnalysisResult { // Renamed from AnalysisResult
  suggested_changes: SuggestedChange[];
  action_plan: ActionPlanItem[];
  groupedSuggestions?: Record<string, SuggestedChange[]>; // Suggestions grouped by source_document_name
}

export interface GroundingChunkWeb {
  uri?: string; 
  title?: string;
}

export interface GroundingChunkRetrieval {
    content?: string;
    title?: string;
}
export interface GroundingChunk {
  web?: GroundingChunkWeb;
  retrieval?: GroundingChunkRetrieval;
}

export interface GroundingMetadata {
  searchQuery?: string;
  groundingChunks?: GroundingChunk[];
}


export enum FetchState {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error',
}

export interface ParsedFileData {
  name: string;
  textContent: string;
  type: 'pdf' | 'txt' | 'generic'; // File type
  lastModified: number;
  size: number;
}

// MIRRORED a ActionPlanItemnd Challenge types
export interface DeepDiveAnalysisResult {
  documentTitleAnalyzed: string;
  overallSummary: string;
  keyThemesAndTopics: string[];
  suggested_changes: SuggestedChange[];
  action_plan: ActionPlanItem[];
  additionalObservations?: string;
  referencedRegulatoryInputs?: string[]; // Names of regulatory docs used as context
  // Grounding metadata (web links) will be stored in SavedAnalysis.groundingMetadata
}


// Updated type for storing saved analyses (Challenge or Deep Dive)
export interface SavedAnalysis {
  id: string; // Unique ID for this saved instance (e.g., UUID or timestamp-based)
  name: string; // User-editable name, defaults to a timestamp-based name
  timestamp: string; // ISO string of when this analysis instance was saved
  
  type: 'challenge' | 'deepDive'; // Type of analysis, 'compliance' renamed to 'challenge'

  // For 'challenge' type
  challengeAnalysisResult?: ChallengeAnalysisResult; // Renamed from analysisResult
  austracInputsUsedSnapshot?: Pick<AustracUpdate, 'id' | 'title' | 'type' | 'dateAdded'>[]; 
  companyDocumentsUsedSnapshot?: Pick<CompanyDocument, 'id' | 'name' | 'type' | 'lastModified' | 'size'>[];
  summarizedAustracUpdatesSnapshot?: AustracUpdate[]; 
  learningsAppliedToThisAnalysis?: string[]; 

  // For 'deepDive' type
  selectedDocumentSnapshot?: Pick<CompanyDocument, 'id' | 'name' | 'type' | 'lastModified' | 'size'>;
  deepDiveAnalysisResult?: DeepDiveAnalysisResult; // Will now contain suggested_changes and action_plan
  groundingMetadata?: GroundingMetadata; // For web search results from deep dive
  
  // Prompts used for the analysis
  userPrompt?: string;
  systemPrompt?: string;
}

// Type for RAG system (chunks retrieved from Vertex AI RAG)
export interface DocumentChunk {
  id: string; // Unique ID for the chunk, e.g., `${documentId}-chunk-${index}`
  documentId: string; // ID of the source document (CompanyDocument or AustracUpdate)
  documentName: string; // Name/title of the source document
  documentType: 'company' | 'austrac'; // Type of source document
  text: string; // The actual text content of the chunk
  keywords: string[]; // Keywords associated with this chunk by Vertex AI (simulated)
  charCount: number; // Character count of the chunk
}