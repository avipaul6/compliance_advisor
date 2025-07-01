





import React, { useState, useCallback, useEffect } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import type { GenerateContentResponse, Content } from "@google/genai";
import * as pdfjsLib from 'pdfjs-dist';
import { diffWordsWithSpace, type Change } from 'diff'; 
import { AustracUpdate, ChallengeAnalysisResult, GroundingMetadata, CompanyDocument, FetchState, SuggestedChange, ActionPlanItem, UserFeedback, SavedAnalysis, DocumentChunk, DeepDiveAnalysisResult } from './types'; 
import { 
    GEMINI_TEXT_MODEL, ICONS, CHAT_HISTORY_KEY, INTERNAL_CORPUS_KEY, USER_AUSTRAC_CONTENT_KEY, 
    SAVED_ANALYSES_KEY, ACTIVE_ANALYSIS_ID_KEY, CHATBOT_LEARNINGS_KEY,
    RAG_TOP_K_CHUNKS_ANALYSIS, RAG_TOP_K_CHUNKS_CHAT, RAG_TOP_K_CHUNKS_DEEP_DIVE_LEGISLATION, RAG_TOP_K_CHUNKS_DEEP_DIVE_COMPANY_DOC
} from './constants.tsx'; 
import { generateUniqueId, formatBytes } from './utils';
import { ingestDocumentToVertexAI, retrieveContextFromVertexAI } from './ragService'; 
import Header from './components/Header';
import Footer from './components/Footer';
import SuggestedChangeCard from './components/SuggestedChangeCard';
import ActionPlanItemCard from './components/ActionPlanItemCard';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorDisplay from './components/ErrorDisplay';
import CompanyDocumentsPage from './components/CompanyDocumentsPage';
import AustracInputsPage from './components/AustracInputsPage'; 
import DraftTextModal from './components/DraftTextModal';
import AnalysisHistoryPage from './components/AnalysisHistoryPage';
import DocumentDeepDivePage from './components/DocumentDeepDivePage';
import PromptDisplay from './components/PromptDisplay';


const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [ai, setAi] = useState<GoogleGenAI | null>(null);
  
  const [userAustracContent, setUserAustracContent] = useState<AustracUpdate[]>([]); 
  const [internalCorpus, setInternalCorpus] = useState<CompanyDocument[]>([]);
  
  // Active Gap Review display states
  const [challengeResult, setChallengeResult] = useState<ChallengeAnalysisResult | null>(null); 
  const [summarizedUserAustracUpdates, setSummarizedUserAustracUpdates] = useState<AustracUpdate[]>([]);
  const [currentInputsForChallenge, setCurrentInputsForChallenge] = useState<{ 
    companyDocs: Pick<CompanyDocument, 'id' | 'name' | 'type' | 'lastModified' | 'size'>[],
    austracContent: Pick<AustracUpdate, 'id' | 'title' | 'type' | 'dateAdded'>[]
  }>({ companyDocs: [], austracContent: [] });
  const [selectedRegulatoryIdsForGapReview, setSelectedRegulatoryIdsForGapReview] = useState<string[]>([]);
  const [selectedCompanyDocIdsForGapReview, setSelectedCompanyDocIdsForGapReview] = useState<string[]>([]);


  const [fetchStatus, setFetchStatus] = useState<FetchState>(FetchState.IDLE); // For Gap Review
  const [error, setError] = useState<string | null>( 
    (typeof process.env.API_KEY === 'undefined' || process.env.API_KEY === '') 
    ? "API_KEY environment variable not found. Please set it to use the AI features."
    : null
  );
    
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [chatMessages, setChatMessages] = useState<{sender: 'user' | 'model', text: string, grounding?: GroundingMetadata, retrievedContext?: DocumentChunk[]}[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'challenge' | 'deepDive' | 'austracInputs' | 'companyDocs' | 'chat' | 'history'>('challenge'); 
  const [currentChatSystemPrompt, setCurrentChatSystemPrompt] = useState<string>('');

  // State for Draft Text Modal (shared)
  const [showDraftModal, setShowDraftModal] = useState<boolean>(false);
  const [currentDraftingChange, setCurrentDraftingChange] = useState<SuggestedChange | null>(null); // Unified to only use SuggestedChange
  const [originalDocumentForDraft, setOriginalDocumentForDraft] = useState<CompanyDocument | null>(null);
  const [draftedTextContent, setDraftedTextContent] = useState<string | null>(null); 
  const [draftDiffResult, setDraftDiffResult] = useState<Change[] | null>(null); 
  const [isDraftingText, setIsDraftingText] = useState<boolean>(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  // Analysis History State (shared for Gap Review and deep dive)
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null); 

  // Chatbot Learnings State
  const [chatbotLearnings, setChatbotLearnings] = useState<string[]>([]);
  const [activeChatLearningsCount, setActiveChatLearningsCount] = useState<number>(0);
  
  // Notifications for different analysis types
  const [challengeNotification, setChallengeNotification] = useState<string | null>(null); 
  const [deepDiveAnalysisNotification, setDeepDiveAnalysisNotification] = useState<string | null>(null);


  // RAG State (Simulated Vertex AI Ingestion)
  const [isIngestionProcessing, setIsIngestionProcessing] = useState<boolean>(false); 
  const [ingestionStatus, setIngestionStatus] = useState<string>(''); 

  // Document Deep Dive State
  const [selectedDocForDeepDiveId, setSelectedDocForDeepDiveId] = useState<string | null>(null);
  const [deepDiveResult, setDeepDiveResult] = useState<DeepDiveAnalysisResult | null>(null);
  const [deepDiveFetchStatus, setDeepDiveFetchStatus] = useState<FetchState>(FetchState.IDLE);
  const [deepDiveError, setDeepDiveError] = useState<string | null>(null);
  const [deepDiveGroundingMetadata, setDeepDiveGroundingMetadata] = useState<GroundingMetadata | null>(null);

  // Prompts for currently displayed analysis
  const [currentAnalysisPrompts, setCurrentAnalysisPrompts] = useState<{ system: string; user: string } | null>(null);


  // Function to extract learnings from feedback
  const extractLearningsFromFeedback = useCallback((analyses: SavedAnalysis[], maxLearnings?: number): string[] => {
    const learnings: string[] = [];
    const MAX_NOTE_LENGTH = 100; 
    const MAX_ADOPTED_TEXT_LENGTH = 750;

    const sortedAnalyses = [...analyses].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    for (const analysis of sortedAnalyses) {
      const resultSource = analysis.type === 'challenge' ? analysis.challengeAnalysisResult : analysis.deepDiveAnalysisResult;
      if (resultSource?.suggested_changes) { 
        for (const change of resultSource.suggested_changes) { 
          if (maxLearnings !== undefined && learnings.length >= maxLearnings) break;
          if (change.userFeedback) {
            const { status, notes, finalAdoptedText } = change.userFeedback;
            if (status && (status === "Actioned" || finalAdoptedText || (status === "Not Applicable" && notes && notes.trim() !== ''))) {
              const analysisTypeLabel = analysis.type === 'challenge' ? 'Gap Review' : 'Deep Dive';
              let learningPoint = `Feedback for suggestion regarding '${change.document_section}' (${analysisTypeLabel}: ${analysis.name.substring(0,20)}...): User status set to '${status}'.`; 
              if (notes) learningPoint += ` Note: "${notes.substring(0, MAX_NOTE_LENGTH)}${notes.length > MAX_NOTE_LENGTH ? '...' : ''}".`;
              if (finalAdoptedText) learningPoint += ` Adopted Text: "${finalAdoptedText.substring(0, MAX_ADOPTED_TEXT_LENGTH)}${finalAdoptedText.length > MAX_ADOPTED_TEXT_LENGTH ? '...' : ''}".`;
              learnings.push(learningPoint);
            }
          }
        }
      }
      if (maxLearnings !== undefined && learnings.length >= maxLearnings) break;
    }
    return learnings;
  }, []);

  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/build/pdf.worker.min.mjs';

    const apiKeyFromEnv = process.env.API_KEY;
    if (apiKeyFromEnv) {
      setApiKey(apiKeyFromEnv);
      try {
        const genAI = new GoogleGenAI({ apiKey: apiKeyFromEnv });
        setAi(genAI);
         setError(null); 
      } catch (e) {
         setError(`Failed to initialize Gemini AI: ${ (e as Error).message }. Ensure your API key is correctly configured.`);
         setFetchStatus(FetchState.ERROR);
         setDeepDiveFetchStatus(FetchState.ERROR); 
      }
    } else {
        setError("API_KEY environment variable not found. Please set it to use the AI features.");
        setFetchStatus(FetchState.ERROR);
        setDeepDiveFetchStatus(FetchState.ERROR); 
    }

    const savedChatHistory = localStorage.getItem(CHAT_HISTORY_KEY);
    if (savedChatHistory) { try { const parsedHistory = JSON.parse(savedChatHistory); if (Array.isArray(parsedHistory)) setChatMessages(parsedHistory); } catch (e) { localStorage.removeItem(CHAT_HISTORY_KEY); }}

    const savedInternalCorpus = localStorage.getItem(INTERNAL_CORPUS_KEY);
    if (savedInternalCorpus) { try { const parsedCorpus = JSON.parse(savedInternalCorpus); if (Array.isArray(parsedCorpus)) setInternalCorpus(parsedCorpus); } catch(e) { console.error("Failed to parse internal corpus", e); localStorage.removeItem(INTERNAL_CORPUS_KEY); }}
    
    const savedUserAustracContent = localStorage.getItem(USER_AUSTRAC_CONTENT_KEY);
    if (savedUserAustracContent) { try { const parsedAustrac = JSON.parse(savedUserAustracContent); if (Array.isArray(parsedAustrac)) setUserAustracContent(parsedAustrac); } catch(e) { console.error("Failed to parse AUSTRAC content", e); localStorage.removeItem(USER_AUSTRAC_CONTENT_KEY); }}
    
    const savedAnalysesFromStorage = localStorage.getItem(SAVED_ANALYSES_KEY);
    let loadedAnalyses: SavedAnalysis[] = [];
    if (savedAnalysesFromStorage) { try { const parsed = JSON.parse(savedAnalysesFromStorage) as SavedAnalysis[]; if (Array.isArray(parsed) && parsed.every(sa => sa.id && sa.name && sa.timestamp && sa.type && (sa.challengeAnalysisResult || sa.deepDiveAnalysisResult))) { loadedAnalyses = parsed.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); setSavedAnalyses(loadedAnalyses); } else { localStorage.removeItem(SAVED_ANALYSES_KEY);}} catch (e) { console.error("Failed to parse saved analyses", e); localStorage.removeItem(SAVED_ANALYSES_KEY); }}  
    
    const storedLearnings = localStorage.getItem(CHATBOT_LEARNINGS_KEY);
    if (storedLearnings) { try { const parsedLearnings = JSON.parse(storedLearnings); if (Array.isArray(parsedLearnings)) setChatbotLearnings(parsedLearnings); } catch (e) { console.error("Failed to parse chatbot learnings", e); localStorage.removeItem(CHATBOT_LEARNINGS_KEY); }}
    else if (loadedAnalyses.length > 0) { const initialLearnings = extractLearningsFromFeedback(loadedAnalyses, 10); setChatbotLearnings(initialLearnings); localStorage.setItem(CHATBOT_LEARNINGS_KEY, JSON.stringify(initialLearnings)); }

    const storedActiveAnalysisId = localStorage.getItem(ACTIVE_ANALYSIS_ID_KEY);
    if (storedActiveAnalysisId && loadedAnalyses.some(sa => sa.id === storedActiveAnalysisId)) { loadAnalysisForViewing(storedActiveAnalysisId, loadedAnalyses); } 
    else if (loadedAnalyses.length > 0) { loadAnalysisForViewing(loadedAnalyses[0].id, loadedAnalyses); } 
    else { setFetchStatus(FetchState.IDLE); setDeepDiveFetchStatus(FetchState.IDLE); }
  }, [extractLearningsFromFeedback]); 

  // BUG FIX: Save chat history whenever it changes, regardless of the active tab.
  useEffect(() => {
    if (chatMessages.length > 0) {
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatMessages));
    } else if (localStorage.getItem(CHAT_HISTORY_KEY)) {
      localStorage.removeItem(CHAT_HISTORY_KEY);
    }
  }, [chatMessages]);

  useEffect(() => { if (internalCorpus.length > 0) localStorage.setItem(INTERNAL_CORPUS_KEY, JSON.stringify(internalCorpus)); else if (localStorage.getItem(INTERNAL_CORPUS_KEY)) localStorage.removeItem(INTERNAL_CORPUS_KEY); if (ai) { setCurrentChat(null); setCurrentChatSystemPrompt(''); setActiveChatLearningsCount(0);} }, [internalCorpus, ai]);
  useEffect(() => { if (userAustracContent.length > 0) localStorage.setItem(USER_AUSTRAC_CONTENT_KEY, JSON.stringify(userAustracContent)); else if (localStorage.getItem(USER_AUSTRAC_CONTENT_KEY)) localStorage.removeItem(USER_AUSTRAC_CONTENT_KEY); if (ai) { setCurrentChat(null); setCurrentChatSystemPrompt(''); setActiveChatLearningsCount(0); } }, [userAustracContent, ai]);
  
  useEffect(() => {
    if (savedAnalyses.length > 0) {
      localStorage.setItem(SAVED_ANALYSES_KEY, JSON.stringify(savedAnalyses));
      const newLearnings = extractLearningsFromFeedback(savedAnalyses, 10);
      setChatbotLearnings(newLearnings);
      localStorage.setItem(CHATBOT_LEARNINGS_KEY, JSON.stringify(newLearnings));
    } else if (localStorage.getItem(SAVED_ANALYSES_KEY)) {
      localStorage.removeItem(SAVED_ANALYSES_KEY);
      localStorage.removeItem(CHATBOT_LEARNINGS_KEY); 
      setChatbotLearnings([]);
    }
  }, [savedAnalyses, extractLearningsFromFeedback]);

  useEffect(() => {
    if (activeAnalysisId) {
      localStorage.setItem(ACTIVE_ANALYSIS_ID_KEY, activeAnalysisId);
    } else {
      localStorage.removeItem(ACTIVE_ANALYSIS_ID_KEY);
    }
  }, [activeAnalysisId]);

  // FIX: This effect ensures that if the user switches to a tab that doesn't match the
  // type of the currently viewed historical analysis, the view is reset.
  useEffect(() => {
    if (activeAnalysisId) {
      const activeAnalysis = savedAnalyses.find(sa => sa.id === activeAnalysisId);
      if (!activeAnalysis) return;

      if (activeTab === 'challenge' && activeAnalysis.type !== 'challenge') {
        // Switched to Gap Review tab, but a Deep Dive is loaded. Clear the view.
        setActiveAnalysisId(null);
        setChallengeResult(null);
        setSummarizedUserAustracUpdates([]);
        setCurrentInputsForChallenge({companyDocs: [], austracContent: []});
        setSelectedRegulatoryIdsForGapReview([]);
        setFetchStatus(FetchState.IDLE);
        setError(null);
        setChallengeNotification(null);
        setCurrentAnalysisPrompts(null);
      } else if (activeTab === 'deepDive' && activeAnalysis.type !== 'deepDive') {
        // Switched to Deep Dive tab, but a Gap Review is loaded. Clear the view.
        setActiveAnalysisId(null);
        setDeepDiveResult(null);
        setSelectedDocForDeepDiveId(null);
        setDeepDiveGroundingMetadata(null);
        setDeepDiveFetchStatus(FetchState.IDLE);
        setDeepDiveError(null);
        setDeepDiveAnalysisNotification(null);
        setCurrentAnalysisPrompts(null);
      }
    }
  }, [activeTab, activeAnalysisId, savedAnalyses]);


  const ingestAllUnprocessedDocuments = useCallback(async (forceReprocessAll: boolean = false) => {
    if (!ai) { 
      setError("AI client not initialized. Cannot start ingestion process.");
      setDeepDiveError("AI client not initialized. Cannot start ingestion process.");
      return;
    }
    setIsIngestionProcessing(true);
    setIngestionStatus('Starting Vertex AI RAG document ingestion (simulated)...');
    let ingestedCount = 0;
    let failedCount = 0;
    const totalDocsToConsider = internalCorpus.length + userAustracContent.length;
    let currentDocProcessingIndex = 0;

    const processAndIngestDoc = async (doc: CompanyDocument | AustracUpdate, type: 'company' | 'austrac') => {
        const docNameOrTitle = type === 'company' ? (doc as CompanyDocument).name : (doc as AustracUpdate).title;
        currentDocProcessingIndex++;
        if (!forceReprocessAll && doc.isProcessedForRag) {
            setIngestionStatus(`Skipping already ingested: ${docNameOrTitle} (${currentDocProcessingIndex}/${totalDocsToConsider})`);
            ingestedCount++; 
            return;
        }
        setIngestionStatus(`Ingesting ${docNameOrTitle} to Vertex AI RAG (${currentDocProcessingIndex}/${totalDocsToConsider})...`);
        try {
            const result = await ingestDocumentToVertexAI(doc, type);
            if (result.success) {
                ingestedCount++;
                if (type === 'company') {
                    setInternalCorpus(prev => prev.map(d => d.id === doc.id ? {...d, isProcessedForRag: true} : d));
                } else {
                    setUserAustracContent(prev => prev.map(u => u.id === doc.id ? {...u, isProcessedForRag: true} : u));
                }
            } else {
                failedCount++;
                console.error(`Failed to ingest ${docNameOrTitle}: ${result.message}`);
            }
        } catch (ingestionError) {
            failedCount++;
            console.error(`Error during ingestion of ${docNameOrTitle}:`, ingestionError);
        }
    };

    for (const doc of internalCorpus) {
        await processAndIngestDoc(doc, 'company');
    }
    for (const doc of userAustracContent) {
        await processAndIngestDoc(doc, 'austrac');
    }

    setIsIngestionProcessing(false);
    let finalMessage = `Vertex AI RAG ingestion complete (simulated). ${ingestedCount - failedCount} successful, ${failedCount} failed.`;
    if (forceReprocessAll) finalMessage = `Vertex AI RAG re-ingestion complete (simulated). ${ingestedCount - failedCount} successful, ${failedCount} failed.`
    if (totalDocsToConsider === 0) finalMessage = "No documents to ingest into Vertex AI RAG.";
    setIngestionStatus(finalMessage);
    setTimeout(() => setIngestionStatus(''), 5000); 
  }, [ai, internalCorpus, userAustracContent]);


  const loadAnalysisForViewing = (analysisIdToLoad: string, analysesList?: SavedAnalysis[]) => {
    const listToUse = analysesList || savedAnalyses;
    const analysisToLoad = listToUse.find(sa => sa.id === analysisIdToLoad);

    if (analysisToLoad) {
        setActiveAnalysisId(analysisToLoad.id);
        setChallengeNotification(null); 
        setDeepDiveAnalysisNotification(null);
        setError(null);
        setDeepDiveError(null);

        if (analysisToLoad.systemPrompt && analysisToLoad.userPrompt) {
            setCurrentAnalysisPrompts({ system: analysisToLoad.systemPrompt, user: analysisToLoad.userPrompt });
        } else {
            setCurrentAnalysisPrompts(null);
        }

        if (analysisToLoad.type === 'challenge' && analysisToLoad.challengeAnalysisResult) { 
            setChallengeResult(analysisToLoad.challengeAnalysisResult); 
            setSummarizedUserAustracUpdates(analysisToLoad.summarizedAustracUpdatesSnapshot || []);
            setCurrentInputsForChallenge({ 
                companyDocs: analysisToLoad.companyDocumentsUsedSnapshot || [],
                austracContent: analysisToLoad.austracInputsUsedSnapshot || []
            });
            setSelectedRegulatoryIdsForGapReview([]); // Clear selection when loading historical
            setSelectedCompanyDocIdsForGapReview([]); // Clear selection when loading historical
            setFetchStatus(FetchState.SUCCESS);
            // Clear deep dive states
            setDeepDiveResult(null); setSelectedDocForDeepDiveId(null); setDeepDiveGroundingMetadata(null); setDeepDiveFetchStatus(FetchState.IDLE);
            setActiveTab('challenge'); 
        } else if (analysisToLoad.type === 'deepDive' && analysisToLoad.deepDiveAnalysisResult) {
            setDeepDiveResult(analysisToLoad.deepDiveAnalysisResult);
            setSelectedDocForDeepDiveId(analysisToLoad.selectedDocumentSnapshot?.id || null);
            setDeepDiveGroundingMetadata(analysisToLoad.groundingMetadata || null);
            setDeepDiveFetchStatus(FetchState.SUCCESS);
            // Clear Gap Review states
            setChallengeResult(null); setSummarizedUserAustracUpdates([]); setCurrentInputsForChallenge({companyDocs: [], austracContent: []}); setFetchStatus(FetchState.IDLE); 
            setActiveTab('deepDive');
        } else {
             console.warn(`Analysis with ID ${analysisIdToLoad} found but has unexpected type or missing data.`);
             setFetchStatus(FetchState.IDLE); setDeepDiveFetchStatus(FetchState.IDLE);
             setCurrentAnalysisPrompts(null);
        }
    } else {
        console.warn(`Analysis with ID ${analysisIdToLoad} not found to load.`);
        setChallengeResult(null); setSummarizedUserAustracUpdates([]); setCurrentInputsForChallenge({companyDocs: [], austracContent: []}); 
        setDeepDiveResult(null); setSelectedDocForDeepDiveId(null); setDeepDiveGroundingMetadata(null);
        setActiveAnalysisId(null); 
        setFetchStatus(FetchState.IDLE); setDeepDiveFetchStatus(FetchState.IDLE);
        setCurrentAnalysisPrompts(null);
    }
  };
  
  const selectContextualLearningsForChat = useCallback(( generalRecentLearnings: string[], activeAnalysis: SavedAnalysis | null, allSavedAnalyses: SavedAnalysis[], extractAllLearningsFn: (analyses: SavedAnalysis[]) => string[], maxTotalLearnings: number = 10 ): string[] => {
    if (!activeAnalysis) return generalRecentLearnings;
    
    const fullPotentialLearnings = extractAllLearningsFn(allSavedAnalyses);
    
    const activeAnalysisNameSub = activeAnalysis.name.substring(0, 20);
    const activeAnalysisType = activeAnalysis.type === 'challenge' ? 'Gap Review' : 'Deep Dive';
    const activeAnalysisSpecificLearnings = fullPotentialLearnings.filter(learning => learning.includes(`(${activeAnalysisType}: ${activeAnalysisNameSub}...)`));
    
    let combinedLearnings: string[] = [...activeAnalysisSpecificLearnings];
    if (combinedLearnings.length < maxTotalLearnings) { for (const generalLearning of generalRecentLearnings) { if (combinedLearnings.length >= maxTotalLearnings) break; if (!combinedLearnings.includes(generalLearning)) combinedLearnings.push(generalLearning); }}
    return combinedLearnings.slice(0, maxTotalLearnings);
  }, []);

  const selectContextualLearningsForChallengePrompt = useCallback(( allPotentialLearnings: string[], currentCompanyDocsForChallenge: Pick<CompanyDocument, 'name'>[], maxLearningsForPrompt: number = 7 ): string[] => { 
    if (currentCompanyDocsForChallenge.length === 0 || allPotentialLearnings.length === 0) return [];
    const contextualLearnings: string[] = []; const addedLearningContents: Set<string> = new Set(); 
    const learningDocSectionRegex = /regarding '(.*?)'/; 
    for (const learningString of allPotentialLearnings) { if (contextualLearnings.length >= maxLearningsForPrompt) break; const match = learningString.match(learningDocSectionRegex); if (match && match[1]) { const docSectionFromLearning = match[1].toLowerCase(); for (const companyDoc of currentCompanyDocsForChallenge) { if (docSectionFromLearning.includes(companyDoc.name.toLowerCase())) { const coreLearningContentMatch = learningString.match(/: User status set to '(.*)'\.( Note: ".*")?( Adopted Text: ".*")?/); const coreLearningContent = coreLearningContentMatch ? coreLearningContentMatch[1] + (coreLearningContentMatch[2] || '') + (coreLearningContentMatch[3] || '') : learningString; if (!addedLearningContents.has(docSectionFromLearning + coreLearningContent)) { contextualLearnings.push(learningString); addedLearningContents.add(docSectionFromLearning + coreLearningContent); break; }}}}}
    return contextualLearnings;
  }, []);


  const initializeChat = useCallback(async ( existingMessages?: {sender: 'user' | 'model', text: string, grounding?: GroundingMetadata}[], currentInternalCorpusForChat?: CompanyDocument[], currentUserAustracContentForChat?: AustracUpdate[], currentGeneralLearnings?: string[], currentActiveAnalysisForContext?: SavedAnalysis | null, allAnalysesForContext?: SavedAnalysis[] ) => {
    if (!ai || !currentGeneralLearnings || !allAnalysesForContext || isIngestionProcessing) return; 
    
    const uningestedDocsExist = internalCorpus.some(d => !d.isProcessedForRag) || userAustracContent.some(d => !d.isProcessedForRag);
    if (uningestedDocsExist && !isIngestionProcessing) { 
        setIngestionStatus("Some documents are not yet ingested into Vertex AI RAG. Chat context might be limited. Consider ingesting all documents.");
    }


    let historyForGemini: Content[] = [];
    let initialDisplayMessages: {sender: 'user' | 'model', text: string, grounding?: GroundingMetadata}[] = [];
    
    const hasUserUploadedDocs = currentInternalCorpusForChat && currentInternalCorpusForChat.length > 0;
    const hasUserAustracContent = currentUserAustracContentForChat && currentUserAustracContentForChat.length > 0;
    
    const finalLearningsForPrompt = selectContextualLearningsForChat( currentGeneralLearnings, currentActiveAnalysisForContext, allAnalysesForContext, (analyses) => extractLearningsFromFeedback(analyses) );
    setActiveChatLearningsCount(finalLearningsForPrompt.length);
    const hasChatbotLearnings = finalLearningsForPrompt.length > 0;

    let systemNoteForUser = "Chat initialized.\nSystem Note: AI will attempt to retrieve relevant information from your ingested documents (via simulated Vertex AI RAG) to answer your questions.\n";
    if (hasUserUploadedDocs) { const docList = currentInternalCorpusForChat.map(doc => `'${doc.name}' (${doc.isProcessedForRag ? 'Ingested' : 'Not Ingested'})`).join(', '); systemNoteForUser += `Using Company Documents for context: ${docList}. `; } else { systemNoteForUser += `System Note: No Company Documents uploaded. General knowledge will be used. `; }
    if (hasUserAustracContent) { const austracContentList = currentUserAustracContentForChat.map(item => `'${item.title}' (${item.isProcessedForRag ? 'Ingested' : 'Not Ingested'})`).join(', '); systemNoteForUser += `Using Regulatory content: ${austracContentList}.`; }
    if (hasChatbotLearnings) { systemNoteForUser += `\nSystem Note: AI is using ${finalLearningsForPrompt.length} learning(s) from past feedback`; if (currentActiveAnalysisForContext) { systemNoteForUser += `, prioritizing insights relevant to ${currentActiveAnalysisForContext.type === 'challenge' ? 'Gap Review' : 'deep dive'} '${currentActiveAnalysisForContext.name}'.`; } else { systemNoteForUser += ` (based on most recent feedback).`; } systemNoteForUser += ` These guide responses and help avoid redundancy.`; } 
    if (systemNoteForUser.trim() !== "Chat initialized.") { if (!existingMessages || existingMessages.length === 0) { initialDisplayMessages.push({sender: 'user', text: systemNoteForUser.trim(), grounding: undefined}); initialDisplayMessages.push({sender: 'model', text: `Okay, I understand. How can I assist you today?`, grounding: undefined}); }}

    if (existingMessages && existingMessages.length > 0) { const userAndModelMessages = existingMessages.filter(msg => !msg.text.startsWith("System Note:") && !msg.text.startsWith("Chat initialized.")); historyForGemini.push(...userAndModelMessages.map(msg => ({ role: msg.sender === 'user' ? 'user' : 'model', parts: [{ text: msg.text }], }))); if (initialDisplayMessages.length > 0) { initialDisplayMessages.push(...userAndModelMessages); } else { initialDisplayMessages = [...userAndModelMessages]; }}
    
    let baseSystemInstruction = `You are an expert compliance assistant specializing in AUSTRAC regulations. You always answer from the perspective of applying a "risk-based approach," where compliance efforts are proportionate to the identified risks.
When the user asks a question, I will provide you with their question AND some "Retrieved Context" from their ingested documents (Company policies, Regulatory updates via a simulated Vertex AI RAG system).
Your primary goal is to answer the user's question based *first and foremost* on this "Retrieved Context".
If the context is insufficient, then use your general knowledge about AUSTRAC.
${hasUserUploadedDocs ? `The user has uploaded Company Documents. Refer to them by name if the "Retrieved Context" mentions specific document names.` : `No Company Documents are currently uploaded.`}
${hasUserAustracContent ? `The user has provided Regulatory content. Refer to them by name if "Retrieved Context" mentions specific regulatory item titles.` : ''}
Use Google Search grounding for recent public information if needed ONLY if the retrieved context and your general knowledge are insufficient.`;

    if (hasChatbotLearnings && finalLearningsForPrompt) { const learningsText = finalLearningsForPrompt.map(learning => `- ${learning}`).join('\n'); baseSystemInstruction += `\n\nADDITIONAL USER FEEDBACK (LEARNINGS):\n${learningsText}\nBe mindful of these points.`; }

    setCurrentChatSystemPrompt(baseSystemInstruction); 
    const chat = ai.chats.create({ model: GEMINI_TEXT_MODEL, config: { systemInstruction: baseSystemInstruction, tools: [{googleSearch: {}}], }, history: historyForGemini.length > 0 ? historyForGemini : undefined, });
    setCurrentChat(chat);
    
    if (initialDisplayMessages.length > 0 && chatMessages.length === 0) { setChatMessages(initialDisplayMessages); } else if (chatMessages.length === 0) { setChatMessages([]); }

  }, [ai, extractLearningsFromFeedback, selectContextualLearningsForChat, internalCorpus, userAustracContent, isIngestionProcessing]); 

  // BUG FIX: Removed `chatMessages` from dependency array to prevent inefficient re-initialization on every message.
  useEffect(() => { 
    if (ai && activeTab === 'chat' && !currentChat && !isIngestionProcessing) {
      const activeAnalysisObj = activeAnalysisId ? savedAnalyses.find(sa => sa.id === activeAnalysisId) : null;
      initializeChat(chatMessages, internalCorpus, userAustracContent, chatbotLearnings, activeAnalysisObj, savedAnalyses);
    }
  }, [ai, activeTab, currentChat, initializeChat, internalCorpus, userAustracContent, chatbotLearnings, activeAnalysisId, savedAnalyses, isIngestionProcessing]);


  const handleChatSubmit = async () => {
    if (!ai || !currentChat || !chatInput.trim() || isChatLoading || isIngestionProcessing) return;

    const currentMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { sender: 'user', text: currentMessage }]);
    setChatInput('');
    setIsChatLoading(true);
    setError(null); setDeepDiveError(null); 
    setIngestionStatus(''); 

    try {
      setIngestionStatus("Retrieving relevant context from Vertex AI RAG (simulated)...");
      const relevantChunks = await retrieveContextFromVertexAI(currentMessage, RAG_TOP_K_CHUNKS_CHAT);
      setIngestionStatus(""); 

      let augmentedMessage = `User question: "${currentMessage}"`;
      let tempDisplayMessage = `Thinking...`;

      if (relevantChunks.length > 0) {
        const contextText = relevantChunks.map(chunk => `From "${chunk.documentName}" (Type: ${chunk.documentType}):\n${chunk.text}\n---`).join('\n');
        augmentedMessage = `Considering the following retrieved context from user documents (via simulated Vertex AI RAG):\n---\n${contextText}\n---\n\nPlease answer the user's question: "${currentMessage}"`;
        tempDisplayMessage = `Retrieved ${relevantChunks.length} relevant snippet(s) from Vertex AI RAG (simulated) to help answer. Thinking...`;
      } else {
        tempDisplayMessage = `Could not find highly specific snippets in Vertex AI RAG (simulated) for this query. Answering based on general knowledge and instructions. Thinking...`;
      }
      
      setChatMessages(prev => [...prev, {sender: 'model', text: tempDisplayMessage, retrievedContext: relevantChunks.length > 0 ? relevantChunks : undefined}]);
      
      const result: GenerateContentResponse = await currentChat.sendMessage({ message: augmentedMessage });
      const modelResponse = result.text;
      const groundingMetadata = result.candidates?.[0]?.groundingMetadata as GroundingMetadata | undefined;
      
      setChatMessages(prev => {
        const lastMessageIsTemp = prev.length > 0 && (prev[prev.length -1].text.includes("Retrieved") || prev[prev.length -1].text.includes("Could not find highly specific snippets") || prev[prev.length-1].text === "Thinking...");
        return lastMessageIsTemp ? prev.slice(0, -1) : prev;
      });
      setChatMessages(prev => [...prev, { sender: 'model', text: modelResponse, grounding: groundingMetadata, retrievedContext: relevantChunks.length > 0 ? relevantChunks : undefined }]);

    } catch (e) {
      const errorMsg = `Error sending message: ${(e as Error).message}`;
      setError(errorMsg); 
      setChatMessages(prev => {
        const lastMessageIsTemp = prev.length > 0 && (prev[prev.length -1].text.includes("Retrieved") || prev[prev.length -1].text.includes("Could not find highly specific snippets") || prev[prev.length-1].text === "Thinking...");
        return lastMessageIsTemp ? prev.slice(0, -1) : prev;
      });
      setChatMessages(prev => [...prev, { sender: 'model', text: `Sorry, I encountered an error: ${errorMsg}` }]);
    } finally {
      setIsChatLoading(false);
      setIngestionStatus("");
    }
  };

  const handleClearChat = () => { setChatMessages([]); setCurrentChat(null); setCurrentChatSystemPrompt(''); setActiveChatLearningsCount(0); localStorage.removeItem(CHAT_HISTORY_KEY); if (ai) { const activeAnalysisObj = activeAnalysisId ? savedAnalyses.find(sa => sa.id === activeAnalysisId) : null; initializeChat([], internalCorpus, userAustracContent, chatbotLearnings, activeAnalysisObj, savedAnalyses); }};
  const handleShowSystemPrompt = () => { if (!currentChatSystemPrompt) { setChatMessages(prev => [...prev, { sender: 'user', text: "[System Query: Show current bot instructions]" },{ sender: 'model', text: "System prompt is not currently available or chat is not fully initialized." }]); return; } setChatMessages(prev => [ ...prev, { sender: 'user', text: "[System Query: Show current bot instructions]" }, { sender: 'model', text: `Current System Prompt Used for This Chat Session:\n${currentChatSystemPrompt}` } ]); };
  
  const handleDiscussInChat = (item: SuggestedChange) => {
    const analysisName = activeAnalysisId ? savedAnalyses.find(s => s.id === activeAnalysisId)?.name : 'Current Context';
    const analysisType = activeAnalysisId ? (savedAnalyses.find(s => s.id === activeAnalysisId)?.type) : 'item';
    const analysisTypeLabel = analysisType === 'challenge' ? 'Gap Review' : 'deep dive';

    let chatContextMessage = `Let's discuss the following specific suggestion from the ${analysisTypeLabel} named '${analysisName}':\n`;
    chatContextMessage += `    Document/Section: ${item.document_section}\n`;
    chatContextMessage += `    Priority: ${item.priority}\n`;
    chatContextMessage += `    Current Status Summary: ${item.current_status_summary}\n`;
    chatContextMessage += `    AUSTRAC Relevance: ${item.austrac_relevance}\n`;
    chatContextMessage += `    Suggested Modification: ${item.suggested_modification}\n`;
    chatContextMessage += `    Can you provide more details or help me strategize on how to implement this?`;
    setChatInput(chatContextMessage); setActiveTab('chat'); setTimeout(() => document.getElementById('chat-input-field')?.focus(), 0); 
  };
  
  const updateFeedbackInSavedAnalyses = (analysisIdToUpdate: string, updatedAnalysisData: Partial<ChallengeAnalysisResult> | Partial<DeepDiveAnalysisResult>) => {  
    const newSavedAnalyses = savedAnalyses.map(sa => {
        if (sa.id === analysisIdToUpdate) {
            if (sa.type === 'challenge' && sa.challengeAnalysisResult) { 
                return { ...sa, challengeAnalysisResult: { ...sa.challengeAnalysisResult, ...(updatedAnalysisData as Partial<ChallengeAnalysisResult>) }, timestamp: new Date().toISOString() }; 
            } else if (sa.type === 'deepDive' && sa.deepDiveAnalysisResult) {
                 return { ...sa, deepDiveAnalysisResult: { ...sa.deepDiveAnalysisResult, ...(updatedAnalysisData as Partial<DeepDiveAnalysisResult>) }, timestamp: new Date().toISOString() };
            }
        }
        return sa;
    }).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); 
    setSavedAnalyses(newSavedAnalyses); 
  };

  const handleUpdateSuggestedChangeFeedback = (itemId: string, feedbackUpdate: Partial<UserFeedback>) => { if (!activeAnalysisId || !challengeResult) return; const newChallengeResult = { ...challengeResult, suggested_changes: challengeResult.suggested_changes.map(change => change.id === itemId ? { ...change, userFeedback: { ...(change.userFeedback || { lastUpdated: new Date().toISOString(), finalAdoptedText: change.userFeedback?.finalAdoptedText }), ...feedbackUpdate, lastUpdated: new Date().toISOString(), } as UserFeedback, } : change ), }; setChallengeResult(newChallengeResult); updateFeedbackInSavedAnalyses(activeAnalysisId, newChallengeResult); }; 
  const handleUpdateActionPlanItemFeedback = (itemId: string, feedbackUpdate: Partial<UserFeedback>) => { if (!activeAnalysisId || !challengeResult) return; const newChallengeResult = { ...challengeResult, action_plan: challengeResult.action_plan.map(item => item.id === itemId ? { ...item, userFeedback: { ...(item.userFeedback || { lastUpdated: new Date().toISOString() }), ...feedbackUpdate, lastUpdated: new Date().toISOString(), } as UserFeedback, } : item ), }; setChallengeResult(newChallengeResult); updateFeedbackInSavedAnalyses(activeAnalysisId, newChallengeResult); }; 

  const handleUpdateDeepDiveChangeFeedback = (itemId: string, feedbackUpdate: Partial<UserFeedback>) => {
    if (!activeAnalysisId || !deepDiveResult) return;
    const newDeepDiveResult = {
      ...deepDiveResult,
      suggested_changes: deepDiveResult.suggested_changes.map(change =>
        change.id === itemId
          ? { ...change, userFeedback: { ...(change.userFeedback || { lastUpdated: new Date().toISOString(), finalAdoptedText: change.userFeedback?.finalAdoptedText }), ...feedbackUpdate, lastUpdated: new Date().toISOString() } as UserFeedback }
          : change
      ),
    };
    setDeepDiveResult(newDeepDiveResult);
    updateFeedbackInSavedAnalyses(activeAnalysisId, newDeepDiveResult);
  };

  const handleUpdateDeepDiveActionPlanFeedback = (itemId: string, feedbackUpdate: Partial<UserFeedback>) => {
    if (!activeAnalysisId || !deepDiveResult) return;
    const newDeepDiveResult = {
      ...deepDiveResult,
      action_plan: deepDiveResult.action_plan.map(point =>
        point.id === itemId
          ? { ...point, userFeedback: { ...(point.userFeedback || { lastUpdated: new Date().toISOString() }), ...feedbackUpdate, lastUpdated: new Date().toISOString() } as UserFeedback }
          : point
      ),
    };
    setDeepDiveResult(newDeepDiveResult);
    updateFeedbackInSavedAnalyses(activeAnalysisId, newDeepDiveResult);
  };


  const generateGapReview = useCallback(async (targetRegulatoryIds: string[], companyDocIds: string[]) => { 
    if (!ai) { setError("AI client not initialized."); setFetchStatus(FetchState.ERROR); return; }
    if (companyDocIds.length === 0 || targetRegulatoryIds.length === 0) {
      setError("Please select at least one Company Document AND at least one Regulatory Input to target for the Gap Review.");
      setFetchStatus(FetchState.IDLE);
      return;
    }

    const targetedRegulatoryContent = userAustracContent.filter(doc => targetRegulatoryIds.includes(doc.id));
    const targetedCompanyDocs = internalCorpus.filter(doc => companyDocIds.includes(doc.id));

    setFetchStatus(FetchState.LOADING);
    setError(null); setChallengeResult(null); setSummarizedUserAustracUpdates([]); setCurrentInputsForChallenge({companyDocs: [], austracContent: []}); setActiveAnalysisId(null); setChallengeNotification(null); setDeepDiveAnalysisNotification(null); setCurrentAnalysisPrompts(null);

    const uningestedDocsExist = targetedCompanyDocs.some(d => !d.isProcessedForRag) || targetedRegulatoryContent.some(d => !d.isProcessedForRag);
    if (uningestedDocsExist) {
        setIngestionStatus("Some selected documents are not yet ingested for RAG. Analysis may be limited. Processing now (simulated)..."); 
        await ingestAllUnprocessedDocuments(false); 
        setIngestionStatus("Document ingestion for Gap Review complete (simulated)."); 
         setTimeout(() => setIngestionStatus(''), 3000);
    }

    try {
      const allPastLearnings = extractLearningsFromFeedback(savedAnalyses.filter(sa => sa.type === 'challenge'));  
      const contextualLearningsForChallenge = selectContextualLearningsForChallengePrompt( allPastLearnings, targetedCompanyDocs, 7 ); 
      if (contextualLearningsForChallenge.length > 0) { setChallengeNotification(`Generating Gap Review, incorporating ${contextualLearningsForChallenge.length} relevant insight(s) from your past feedback...`); } else { setChallengeNotification(null); } 
      
      const systemPrompt = `
        Analyze the provided context against the company's internal documentation context. This is a "Gap Review" to find gaps and suggest improvements, specifically focusing on the impact of the newly provided regulatory content on the selected company documents.
        The company is a Fintech firm focused on international payments and currency exchange.
        Critically evaluate whether the company's documentation reflects a robust, risk-based approach to compliance, where controls are proportionate to the identified risks.
        Identify specific, actionable changes the company needs to make. Also, create a prioritized action plan.
        ${contextualLearningsForChallenge.length > 0 ? `\n---Important Context from Previous User Feedback:...\n${contextualLearningsForChallenge.map(learning => `- ${learning}`).join('\n')}\n---` : ''}
      `; 

      setChallengeNotification(prev => prev ? `${prev} Summarizing selected regulatory updates...` : `Summarizing ${targetedRegulatoryContent.length} selected regulatory update(s)...`);
      const summarizedUpdatesPromises = targetedRegulatoryContent.map(async (update) => { 
        const summaryPrompt = `Summarize the key compliance implications from the following regulatory content titled "${update.title}". Focus on actionable changes or requirements for a financial services provider, particularly one involved in international payments and currency exchange. The content is: \n\n${update.rawContent.substring(0, 30000)}`;
        try { const summaryResult = await ai.models.generateContent({ model: GEMINI_TEXT_MODEL, contents: summaryPrompt }); return { ...update, summary: summaryResult.text }; } catch (summaryError) { console.error(`Failed to summarize "${update.title}":`, summaryError); return { ...update, summary: "Could not generate summary due to an error." }; }
      });
      const newSummarizedLocalUpdates = await Promise.all(summarizedUpdatesPromises);
      setSummarizedUserAustracUpdates(newSummarizedLocalUpdates); 
      
      setChallengeNotification(prev => prev ? `${prev} Retrieving relevant document sections from Vertex AI RAG (simulated)...` : 'Retrieving relevant document sections from Vertex AI RAG (simulated)...');
      const combinedQueryForRag = `Compliance Gap Review for international payments fintech. Analyze impact of new regulations: ${newSummarizedLocalUpdates.map(u => u.title).join(', ')} against selected company policies. Company documents include: ${targetedCompanyDocs.map(d => d.name).join(', ')}.`; 
      
      const relevantChunks = await retrieveContextFromVertexAI(combinedQueryForRag, RAG_TOP_K_CHUNKS_ANALYSIS);
      
      const austracContextFromChunks = relevantChunks.filter(c => c.documentType === 'austrac' && targetedRegulatoryContent.some(d => d.id === c.documentId)).map(c => `From Regulatory Document "${c.documentName}" (Retrieved via Vertex AI RAG):\n${c.text}`).join('\n\n---\n\n');
      const companyContextFromChunks = relevantChunks.filter(c => c.documentType === 'company' && targetedCompanyDocs.some(d => d.id === c.documentId)).map(c => `From Company Document "${c.documentName}" (Retrieved via Vertex AI RAG):\n${c.text}`).join('\n\n---\n\n');

      let userPromptContext = '';
      if (austracContextFromChunks) { userPromptContext += `\n\nRetrieved Targeted Regulatory Updates Context (from Vertex AI RAG):\n${austracContextFromChunks}`; } 
      else { userPromptContext += `\n\nNo specific Regulatory document context retrieved from Vertex AI RAG; using summaries of the targeted documents. Summaries: \n${newSummarizedLocalUpdates.map(u => `Title: ${u.title}, Summary: ${u.summary || 'N/A'}`).join('\n')}`;}
      
      if (companyContextFromChunks) { userPromptContext += `\n\nRetrieved Company's Internal Documents Context (from Vertex AI RAG):\n${companyContextFromChunks}`; }
      else { userPromptContext += `\n\nNo specific company document context retrieved from Vertex AI RAG; relying on general document names/types provided. Selected company docs: ${targetedCompanyDocs.map(d => d.name).join(', ')}`;}

      const userPrompt = `
        ${userPromptContext}

        Output the analysis in JSON format. For each item in "suggested_changes", you MUST include a "source_document_name" field indicating which of the provided Company Documents it applies to.

        JSON Structure:
        {
          "suggested_changes": [ { "source_document_name": "Name Of The Document.pdf", "document_section": "...", "current_status_summary": "...", "austrac_relevance": "...", "suggested_modification": "...", "priority": "High | Medium | Low" } ],
          "action_plan": [ { "task": "...", "responsible": "...", "timeline": "...", "priority_level": "High | Medium | Low" } ]
        }
        Ensure "document_section" refers to sections within the "source_document_name".
        Prioritize clarity and actionability. If a document is compliant, note it.
      `;
      
      setChallengeNotification(prev => prev ? `${prev} Generating final Gap Review with AI...` : 'Generating final Gap Review with AI...'); 
      const analysisResponse = await ai.models.generateContent({ model: GEMINI_TEXT_MODEL, contents: systemPrompt + userPrompt, config: { responseMimeType: "application/json" }});

      let jsonStr = analysisResponse.text.trim();
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = jsonStr.match(fenceRegex);
      if (match && match[2]) jsonStr = match[2].trim();
      
      const malformationRegex1 = /(})\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*({)/g; // Fix: }word{ -> }, {
      if (malformationRegex1.test(jsonStr)) {
          console.warn(`Fixing JSON malformation (type 1): missing comma between objects.`);
          jsonStr = jsonStr.replace(malformationRegex1, '$1, $3');
      }

      const malformationRegex2 = /(})\s*[a-zA-Z_][a-zA-Z0-9_]*\s*(,)/g; // Fix for extraneous words before a comma, e.g., }ayal, -> },
      if (malformationRegex2.test(jsonStr)) {
        console.warn(`Fixing JSON malformation (type 2): extraneous word before comma.`);
        jsonStr = jsonStr.replace(malformationRegex2, '$1$2');
      }

      // BUG FIX: Fix for missing "priority_level" key in action_plan
      const missingPriorityKeyRegex = /("timeline":\s*".*?",\s*)"(High|Medium|Low)"/g;
      if (missingPriorityKeyRegex.test(jsonStr)) {
        console.warn('Fixing JSON malformation (type 3): missing "priority_level" key.');
        jsonStr = jsonStr.replace(missingPriorityKeyRegex, '$1"priority_level": "$2"');
      }

      try {
        let parsedResult = JSON.parse(jsonStr) as ChallengeAnalysisResult; 
        parsedResult.suggested_changes = (parsedResult.suggested_changes || []).map((change, index) => ({ ...change, id: `sc-${Date.now()}-${index}-${generateUniqueId().substring(0,5)}`, priority: ['High', 'Medium', 'Low'].includes(change.priority) ? change.priority : 'Medium', document_section: change.document_section || "N/A", current_status_summary: change.current_status_summary || "N/A", austrac_relevance: change.austrac_relevance || "N/A", suggested_modification: change.suggested_modification || "N/A", }));
        parsedResult.action_plan = (parsedResult.action_plan || []).map((item, index) => ({ ...item, id: `ap-${Date.now()}-${index}-${generateUniqueId().substring(0,5)}`, priority_level: ['High', 'Medium', 'Low'].includes(item.priority_level) ? item.priority_level : 'Medium', task: item.task || "N/A", responsible: item.responsible || "N/A", timeline: item.timeline || "N/A" }));
        
        const inputsUsed = {
          companyDocs: targetedCompanyDocs.map(d => ({ id: d.id, name: d.name, type: d.type, lastModified: d.lastModified, size: d.size })),
          austracContent: targetedRegulatoryContent.map(d => ({ id: d.id, title: d.title, type: d.type, dateAdded: d.dateAdded })),
        };
        setCurrentInputsForChallenge(inputsUsed);

        const groupedSuggestions: Record<string, SuggestedChange[]> = {};
        (parsedResult.suggested_changes || []).forEach(change => {
            const docName = change.source_document_name || 'General';
            if (!groupedSuggestions[docName]) {
                groupedSuggestions[docName] = [];
            }
            groupedSuggestions[docName].push(change);
        });
        parsedResult.groupedSuggestions = groupedSuggestions;

        setChallengeResult(parsedResult);
        
        const newAnalysisId = `analysis-${Date.now()}`;
        const newSavedAnalysis: SavedAnalysis = {
            id: newAnalysisId,
            name: `Gap Review - ${new Date().toLocaleString()}`,
            timestamp: new Date().toISOString(),
            type: 'challenge',
            challengeAnalysisResult: parsedResult,
            austracInputsUsedSnapshot: inputsUsed.austracContent,
            companyDocumentsUsedSnapshot: inputsUsed.companyDocs,
            summarizedAustracUpdatesSnapshot: newSummarizedLocalUpdates,
            learningsAppliedToThisAnalysis: contextualLearningsForChallenge,
            systemPrompt: systemPrompt,
            userPrompt: userPrompt,
        };
        setSavedAnalyses(prev => [newSavedAnalysis, ...prev]);
        setActiveAnalysisId(newAnalysisId);
        setCurrentAnalysisPrompts({ system: systemPrompt, user: userPrompt });
        
        setFetchStatus(FetchState.SUCCESS);
        setChallengeNotification(null);

        // BUG FIX: Clear selections after a successful run
        setSelectedRegulatoryIdsForGapReview([]);
        setSelectedCompanyDocIdsForGapReview([]);

      } catch (jsonParseError) {
        console.error("Failed to parse AI response JSON:", jsonParseError);
        console.error("Raw response text:", analysisResponse.text);
        setError(`Failed to parse the analysis from the AI. The response was not valid JSON. Raw response logged to console.`);
        setFetchStatus(FetchState.ERROR);
        setChallengeNotification(null);
      }

    } catch (e) {
      console.error("Error generating Gap Review:", e);
      setError(`An error occurred while generating the Gap Review: ${(e as Error).message}`);
      setFetchStatus(FetchState.ERROR);
      setChallengeNotification(null);
    } finally {
        setIngestionStatus('');
    }
  }, [ai, userAustracContent, internalCorpus, savedAnalyses, extractLearningsFromFeedback, selectContextualLearningsForChallengePrompt]);

  const generateDeepDive = useCallback(async (docId: string) => {
    if (!ai) { setDeepDiveError("AI client not initialized."); setDeepDiveFetchStatus(FetchState.ERROR); return; }

    const targetDoc = internalCorpus.find(doc => doc.id === docId);
    if (!targetDoc) { setDeepDiveError("Target document not found."); setDeepDiveFetchStatus(FetchState.ERROR); return; }

    setDeepDiveFetchStatus(FetchState.LOADING);
    setDeepDiveError(null); setDeepDiveResult(null); setActiveAnalysisId(null); setDeepDiveAnalysisNotification("Starting deep dive analysis..."); setChallengeNotification(null); setCurrentAnalysisPrompts(null);
    
    if (!targetDoc.isProcessedForRag) {
        setIngestionStatus(`Target document "${targetDoc.name}" is not ingested. Ingesting now for better context (simulated)...`);
        await ingestAllUnprocessedDocuments(false);
        setIngestionStatus(`Ingestion complete. Continuing with deep dive analysis...`);
        setTimeout(() => setIngestionStatus(''), 3000);
    }
    
    try {
        setDeepDiveAnalysisNotification("Retrieving context from your library and the web (simulated)...");

        const legislativeContextQuery = `Key AUSTRAC regulations and legal frameworks relevant to: ${targetDoc.name}.`;
        const legislativeChunks = await retrieveContextFromVertexAI(legislativeContextQuery, RAG_TOP_K_CHUNKS_DEEP_DIVE_LEGISLATION);
        const legislativeContext = legislativeChunks.length > 0
            ? `Retrieved Regulatory Context (from Vertex AI RAG):\n${legislativeChunks.map(c => `From "${c.documentName}":\n${c.text}`).join('\n---\n')}`
            : "No specific regulatory context retrieved from user's library.";
        const referencedRegulatoryInputs = [...new Set(legislativeChunks.map(c => c.documentName))];

        const selfReflectionQuery = `Internal document consistency check for: ${targetDoc.name}`;
        const companyDocChunks = await retrieveContextFromVertexAI(selfReflectionQuery, RAG_TOP_K_CHUNKS_DEEP_DIVE_COMPANY_DOC);
        const companyContext = companyDocChunks.filter(c => c.documentId !== targetDoc.id).length > 0
            ? `Retrieved Internal Context (from other company docs via Vertex AI RAG):\n${companyDocChunks.filter(c => c.documentId !== targetDoc.id).map(c => `From "${c.documentName}":\n${c.text}`).join('\n---\n')}`
            : "No other relevant company documents found for cross-referencing.";

        const systemPrompt = `
          Perform a "Deep Dive" analysis of the following Company Document.
          Based on all the provided information AND your general knowledge and web search capabilities, provide a comprehensive analysis.
          1.  Start with an "overallSummary" of the document's purpose, strengths, and weaknesses.
          2.  Identify "keyThemesAndTopics" covered in the document.
          3.  Suggest specific, actionable "suggested_changes" to improve compliance, clarity, and alignment with a risk-based approach. The "document_section" should be the document name itself.
          4.  Create a practical "action_plan" for implementing these changes.
          5.  Provide any "additionalObservations" that are relevant.

          Use Google Search to find current best practices or recent regulatory shifts not covered in the provided context.

          Output the analysis in a clean JSON format.
        `;

        const userPrompt = `
          Company Document Name: "${targetDoc.name}"
          
          Document Content:
          ---
          ${targetDoc.textContent}
          ---
          
          Provided Context:
          ---
          ${legislativeContext}
          ---
          ${companyContext}
          ---
          
          JSON Structure:
          {
            "documentTitleAnalyzed": "${targetDoc.name}",
            "overallSummary": "...",
            "keyThemesAndTopics": ["...", "..."],
            "suggested_changes": [ { "document_section": "${targetDoc.name}", "current_status_summary": "...", "austrac_relevance": "...", "suggested_modification": "...", "priority": "High | Medium | Low" } ],
            "action_plan": [ { "task": "...", "responsible": "...", "timeline": "...", "priority_level": "High | Medium | Low" } ],
            "additionalObservations": "...",
            "referencedRegulatoryInputs": ["${referencedRegulatoryInputs.join('", "')}"]
          }
        `;
        
        setDeepDiveAnalysisNotification("Generating deep dive analysis with AI...");
        const response = await ai.models.generateContent({ model: GEMINI_TEXT_MODEL, contents: systemPrompt + userPrompt, config: { tools: [{googleSearch: {}}] }});
        const groundingMetadata = response.candidates?.[0]?.groundingMetadata as GroundingMetadata | undefined;
        setDeepDiveGroundingMetadata(groundingMetadata || null);

        let jsonStr = response.text.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) {
          jsonStr = match[2].trim();
        }
        
        // Robustness fixes copied from generateGapReview
        const malformationRegex1 = /(})\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*({)/g;
        if (malformationRegex1.test(jsonStr)) {
            console.warn(`Fixing JSON malformation (type 1) in Deep Dive: missing comma between objects.`);
            jsonStr = jsonStr.replace(malformationRegex1, '$1, $3');
        }

        const malformationRegex2 = /(})\s*[a-zA-Z_][a-zA-Z0-9_]*\s*(,)/g;
        if (malformationRegex2.test(jsonStr)) {
          console.warn(`Fixing JSON malformation (type 2) in Deep Dive: extraneous word before comma.`);
          jsonStr = jsonStr.replace(malformationRegex2, '$1$2');
        }

        const missingPriorityKeyRegex = /("timeline":\s*".*?",\s*)"(High|Medium|Low)"/g;
        if (missingPriorityKeyRegex.test(jsonStr)) {
          console.warn('Fixing JSON malformation (type 3) in Deep Dive: missing "priority_level" key.');
          jsonStr = jsonStr.replace(missingPriorityKeyRegex, '$1"priority_level": "$2"');
        }
        
        try {
            let parsedResult = JSON.parse(jsonStr) as DeepDiveAnalysisResult;
            parsedResult.suggested_changes = (parsedResult.suggested_changes || []).map((change, index) => ({ ...change, id: `ddsc-${Date.now()}-${index}`, priority: ['High', 'Medium', 'Low'].includes(change.priority) ? change.priority : 'Medium', document_section: change.document_section || targetDoc.name }));
            parsedResult.action_plan = (parsedResult.action_plan || []).map((item, index) => ({ ...item, id: `ddap-${Date.now()}-${index}`, priority_level: ['High', 'Medium', 'Low'].includes(item.priority_level) ? item.priority_level : 'Medium' }));
            setDeepDiveResult(parsedResult);
            
            const newAnalysisId = `analysis-${Date.now()}`;
            const newSavedAnalysis: SavedAnalysis = {
              id: newAnalysisId,
              name: `Deep Dive - ${targetDoc.name}`,
              timestamp: new Date().toISOString(),
              type: 'deepDive',
              deepDiveAnalysisResult: parsedResult,
              selectedDocumentSnapshot: { id: targetDoc.id, name: targetDoc.name, type: targetDoc.type, lastModified: targetDoc.lastModified, size: targetDoc.size },
              groundingMetadata: groundingMetadata || undefined,
              systemPrompt: systemPrompt,
              userPrompt: userPrompt,
            };
            setSavedAnalyses(prev => [newSavedAnalysis, ...prev]);
            setActiveAnalysisId(newAnalysisId);
            setCurrentAnalysisPrompts({ system: systemPrompt, user: userPrompt });

            setDeepDiveFetchStatus(FetchState.SUCCESS);

        } catch (jsonParseError) {
            console.error("Failed to parse Deep Dive AI response JSON:", jsonParseError, "Raw text:", response.text);
            setDeepDiveError("Failed to parse the deep dive analysis from the AI. The response was not valid JSON.");
            setDeepDiveFetchStatus(FetchState.ERROR);
        }
    } catch (e) {
        console.error("Error generating Deep Dive:", e);
        setDeepDiveError(`An error occurred during the Deep Dive: ${(e as Error).message}`);
        setDeepDiveFetchStatus(FetchState.ERROR);
    } finally {
        setDeepDiveAnalysisNotification(null);
        setIngestionStatus('');
    }
  }, [ai, internalCorpus, userAustracContent, savedAnalyses, extractLearningsFromFeedback]);

  const handleGenerateDraft = useCallback(async (changeToDraft: SuggestedChange, docNameFromContext?: string) => {
    if (!ai) { 
        setShowDraftModal(true);
        setIsDraftingText(false);
        setDraftError("AI client not available to generate draft.");
        return; 
    }

    const targetDocName = changeToDraft.source_document_name || docNameFromContext || deepDiveResult?.documentTitleAnalyzed;
    if (!targetDocName) {
        setShowDraftModal(true);
        setIsDraftingText(false);
        setDraftError("Could not determine the source document for this change.");
        setCurrentDraftingChange(changeToDraft);
        setOriginalDocumentForDraft(null);
        return;
    }
    
    const originalDoc = internalCorpus.find(doc => doc.name === targetDocName);
    if (!originalDoc) {
        setShowDraftModal(true);
        setIsDraftingText(false);
        setDraftError(`Original document '${targetDocName}' could not be found. Cannot generate draft.`);
        setCurrentDraftingChange(changeToDraft);
        setOriginalDocumentForDraft(null);
        return;
    }
    
    setShowDraftModal(true); 
    setIsDraftingText(true); 
    setDraftError(null); 
    setDraftedTextContent(null); 
    setDraftDiffResult(null);
    setCurrentDraftingChange(changeToDraft); 
    setOriginalDocumentForDraft(originalDoc);

    const draftPrompt = `
        Based on the following suggestion, please rewrite the provided "Original Text".
        - Document/Section: ${changeToDraft.document_section}
        - Suggested Modification: ${changeToDraft.suggested_modification}
        Your task is to integrate the "Suggested Modification" into the "Original Text".
        Only provide the complete, updated text as a plain string, without any additional explanations, introductions, or markdown formatting.

        Original Text:
        ---
        ${originalDoc.textContent}
        ---
    `;

    try {
        const result = await ai.models.generateContent({ model: GEMINI_TEXT_MODEL, contents: draftPrompt });
        const newDraft = result.text;
        setDraftedTextContent(newDraft);
        setDraftDiffResult(diffWordsWithSpace(originalDoc.textContent, newDraft));
    } catch (e) {
        setDraftError(`Failed to generate draft text: ${(e as Error).message}`);
    } finally {
        setIsDraftingText(false);
    }
  }, [ai, internalCorpus, deepDiveResult]);

  const handleClearDeepDiveView = () => {
    setActiveAnalysisId(null);
    setDeepDiveResult(null);
    setSelectedDocForDeepDiveId(null);
    setDeepDiveGroundingMetadata(null);
    setDeepDiveFetchStatus(FetchState.IDLE);
    setDeepDiveError(null);
    setDeepDiveAnalysisNotification(null);
    setCurrentAnalysisPrompts(null);
  };
  
  const handleDeleteAnalysis = (idToDelete: string) => {
    setSavedAnalyses(prev => prev.filter(sa => sa.id !== idToDelete));
    if (activeAnalysisId === idToDelete) {
        setActiveAnalysisId(null);
        setChallengeResult(null);
        setSummarizedUserAustracUpdates([]);
        setCurrentInputsForChallenge({ companyDocs: [], austracContent: [] });
        setFetchStatus(FetchState.IDLE);
        setDeepDiveResult(null);
        setSelectedDocForDeepDiveId(null);
        setDeepDiveGroundingMetadata(null);
        setDeepDiveFetchStatus(FetchState.IDLE);
        setCurrentAnalysisPrompts(null);
    }
  };

  const handleRenameAnalysis = (idToRename: string, newName: string) => {
    setSavedAnalyses(prev => prev.map(sa => sa.id === idToRename ? { ...sa, name: newName } : sa));
  };

  const renderPriorityBadge = (priority: 'High' | 'Medium' | 'Low') => {
    const badgeStyles = {
      High: 'bg-red-100 text-red-700 border-red-300',
      Medium: 'bg-amber-100 text-amber-700 border-amber-300',
      Low: 'bg-green-100 text-green-700 border-green-300',
    };
    return (
      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${badgeStyles[priority]} whitespace-nowrap`}>
        {priority} Priority
      </span>
    );
  };
  
  const TABS: { id: typeof activeTab, name: string, icon: (className?: string) => React.ReactNode }[] = [
    { id: 'challenge', name: 'Regulatory Target: Gap Review', icon: ICONS.documentSearch },
    { id: 'deepDive', name: 'Document Deep Dive', icon: ICONS.documentSearch },
    { id: 'companyDocs', name: 'Company Documents', icon: ICONS.folder },
    { id: 'austracInputs', name: 'Regulatory Input', icon: ICONS.bookOpen },
    { id: 'chat', name: 'Compliance Chatbot', icon: ICONS.chatBubbleLeftRight },
    { id: 'history', name: 'Analysis History', icon: ICONS.archiveBox },
  ];

  const getTabClass = (tabName: typeof activeTab) => {
    const base = "flex items-center text-sm sm:text-base font-medium px-3 sm:px-4 py-3 border-b-2 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-500 rounded-t-lg";
    if (activeTab === tabName) {
      return `${base} border-orange-500 text-orange-600 bg-white`;
    }
    return `${base} border-transparent text-stone-500 hover:text-orange-600 hover:border-orange-300`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-orange-50 font-sans text-stone-800">
      <Header />
      <main className="flex-grow w-full max-w-screen-2xl mx-auto px-4 md:px-8 py-8">
        
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-orange-200 scrollbar-track-orange-50">
           <nav className="flex space-x-1 border-b border-orange-200 mb-8 w-max sm:w-full">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={getTabClass(tab.id)}>
                {tab.icon("w-5 h-5 mr-2 hidden sm:inline-block")}
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
        
        {error && (activeTab !== 'deepDive' || (activeTab === 'deepDive' && !deepDiveError)) && <ErrorDisplay message={error} className="mb-6"/>}

        <div className="relative">
          {activeTab === 'companyDocs' && (
            <CompanyDocumentsPage 
              companyDocs={internalCorpus}
              setCompanyDocs={setInternalCorpus}
              onIngestAll={ingestAllUnprocessedDocuments}
              isIngestionProcessing={isIngestionProcessing}
              ingestionStatus={ingestionStatus}
              totalDocs={internalCorpus.length + userAustracContent.length}
              ingestedDocsCount={internalCorpus.filter(d => d.isProcessedForRag).length + userAustracContent.filter(u => u.isProcessedForRag).length}
              allDocsIngested={internalCorpus.every(d => d.isProcessedForRag) && userAustracContent.every(u => u.isProcessedForRag)}
              isAiReady={!!ai}
            />
          )}

          {activeTab === 'austracInputs' && (
            <AustracInputsPage 
              userAustracContent={userAustracContent}
              setUserAustracContent={setUserAustracContent}
              onIngestAll={ingestAllUnprocessedDocuments}
              isIngestionProcessing={isIngestionProcessing}
              ingestionStatus={ingestionStatus}
              totalDocs={internalCorpus.length + userAustracContent.length}
              ingestedDocsCount={internalCorpus.filter(d => d.isProcessedForRag).length + userAustracContent.filter(u => u.isProcessedForRag).length}
              allDocsIngested={internalCorpus.every(d => d.isProcessedForRag) && userAustracContent.every(u => u.isProcessedForRag)}
              isAiReady={!!ai}
            />
          )}

          {activeTab === 'history' && (
             <AnalysisHistoryPage
              savedAnalyses={savedAnalyses}
              onSelectAnalysis={loadAnalysisForViewing}
              onDeleteAnalysis={handleDeleteAnalysis}
              onRenameAnalysis={handleRenameAnalysis}
            />
          )}

          {activeTab === 'chat' && (
            <div className="max-w-4xl mx-auto p-4 md:p-6 bg-white shadow-xl rounded-lg border border-orange-200">
                <h2 className="text-3xl font-semibold mb-2 text-orange-600 flex items-center justify-center">
                    {ICONS.chatBubbleLeftRight("w-8 h-8 mr-3 text-orange-500")}
                    Compliance Chatbot
                </h2>
                {activeChatLearningsCount > 0 && <p className="text-xs text-center text-stone-500 mb-4">(This session is enhanced by {activeChatLearningsCount} learning point(s) from your feedback)</p>}

                <div className="h-[60vh] overflow-y-auto p-4 bg-orange-50/70 rounded-lg border border-orange-200 mb-4 flex flex-col space-y-4 scrollbar-thin scrollbar-thumb-orange-300 scrollbar-track-orange-100">
                    {chatMessages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xl p-3 rounded-lg shadow-sm ${msg.sender === 'user' ? 'bg-orange-400 text-white' : 'bg-white text-stone-700 border border-orange-200'}`}>
                                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                                {msg.grounding && msg.grounding.groundingChunks?.some(c => c.web) && (
                                    <div className="mt-2 pt-2 border-t border-orange-200/50">
                                        <p className="text-xs font-semibold mb-1">Web Sources:</p>
                                        <ul className="list-disc list-inside text-xs space-y-1">
                                            {msg.grounding.groundingChunks.filter(c => c.web).map((c, i) => (
                                                <li key={i}><a href={c.web?.uri} target="_blank" rel="noopener noreferrer" className="hover:underline">{c.web?.title || c.web?.uri}</a></li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isChatLoading && (
                        <div className="flex justify-start">
                            <div className="max-w-xl p-3 rounded-lg shadow-sm bg-white text-stone-700 border border-orange-200 flex items-center">
                                <LoadingSpinner size="sm" />
                                <span className="ml-2 text-sm italic">Thinking...</span>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    <input
                        id="chat-input-field"
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !isChatLoading && handleChatSubmit()}
                        className="flex-grow p-3 border border-orange-300 rounded-lg focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="Ask a compliance question..."
                        disabled={isChatLoading || !currentChat || isIngestionProcessing}
                    />
                    <button onClick={handleChatSubmit} disabled={isChatLoading || !chatInput.trim() || !currentChat || isIngestionProcessing} className="bg-orange-500 text-white px-5 py-2 rounded-lg font-semibold hover:bg-orange-600 disabled:bg-stone-300">Send</button>
                    <button onClick={handleClearChat} disabled={isChatLoading} title="Clear Chat History" className="bg-stone-200 text-stone-600 p-3 rounded-lg hover:bg-stone-300 disabled:bg-stone-100">{ICONS.trash("w-5 h-5")}</button>
                    <button onClick={handleShowSystemPrompt} disabled={isChatLoading} title="Show System Prompt" className="bg-stone-200 text-stone-600 p-3 rounded-lg hover:bg-stone-300 disabled:bg-stone-100">{ICONS.informationCircle("w-5 h-5")}</button>
                </div>
            </div>
          )}

          {activeTab === 'deepDive' && (
             <DocumentDeepDivePage
                companyDocs={internalCorpus}
                onStartDeepDive={generateDeepDive}
                analysisResult={deepDiveResult}
                fetchStatus={deepDiveFetchStatus}
                error={deepDiveError}
                groundingMetadata={deepDiveGroundingMetadata}
                isIngestionProcessing={isIngestionProcessing}
                notification={deepDiveAnalysisNotification}
                isAiReady={!!ai}
                isViewingHistorical={!!activeAnalysisId && savedAnalyses.find(sa => sa.id === activeAnalysisId)?.type === 'deepDive'}
                currentAnalysisName={activeAnalysisId ? savedAnalyses.find(sa => sa.id === activeAnalysisId)?.name || null : null}
                onClearView={handleClearDeepDiveView}
                renderPriorityBadge={renderPriorityBadge}
                onGenerateDraft={handleGenerateDraft}
                onDiscussInChat={handleDiscussInChat}
                onUpdateChangeFeedback={handleUpdateDeepDiveChangeFeedback}
                onUpdateActionPlanFeedback={handleUpdateDeepDiveActionPlanFeedback}
                isDraftingEnabled={!!ai}
                prompts={currentAnalysisPrompts}
             />
          )}

          {activeTab === 'challenge' && (
            <div className="max-w-6xl mx-auto">
              {/* Challenge view */}
              {(!activeAnalysisId || savedAnalyses.find(sa => sa.id === activeAnalysisId)?.type !== 'challenge') && (
                  <div className="mb-6 p-4 bg-orange-100/50 border border-orange-200 rounded-lg text-sm text-orange-800">
                      <h2 className="font-semibold text-lg mb-1">Purpose: Strategic Gap Review</h2>
                      <p>Use this tool to <strong className="font-bold">compare your company's documents against specific regulatory inputs</strong>. It's for finding the <strong className="font-bold">gaps</strong> between what the law requires and what your policies say.</p>
                  </div>
              )}

              {activeAnalysisId && savedAnalyses.find(sa => sa.id === activeAnalysisId)?.type === 'challenge' && (
                  <div className="mb-4 p-3 bg-orange-100 border border-orange-300 rounded-lg text-sm text-orange-700 text-center">
                      {ICONS.archiveBox("w-5 h-5 mr-2 inline-block")}
                      Currently viewing historical gap review: <strong>{savedAnalyses.find(sa => sa.id === activeAnalysisId)?.name}</strong>.
                      <button
                          onClick={() => { setActiveAnalysisId(null); setChallengeResult(null); setFetchStatus(FetchState.IDLE); setCurrentAnalysisPrompts(null); }}
                          className="ml-2 text-orange-600 hover:text-orange-800 underline text-xs"
                      >
                          (Clear View & Prepare New Gap Review)
                      </button>
                  </div>
              )}

              {(fetchStatus === FetchState.IDLE || fetchStatus === FetchState.ERROR) && !challengeResult && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                      {/* Company Docs Selection */}
                      <div className="p-6 bg-white shadow-lg rounded-lg border border-orange-200">
                          <h3 className="text-xl font-semibold text-stone-700 mb-3">1. Select Company Documents to Review</h3>
                          {internalCorpus.length === 0 ? <p className="text-sm text-stone-500">Please upload documents on the "Company Documents" tab first.</p> :
                              <div className="max-h-60 overflow-y-auto space-y-2 p-2 border rounded-md bg-orange-50/50">
                                  {internalCorpus.map(doc => (
                                      <label key={doc.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-orange-100 cursor-pointer">
                                          <input type="checkbox" checked={selectedCompanyDocIdsForGapReview.includes(doc.id)} onChange={() => setSelectedCompanyDocIdsForGapReview(prev => prev.includes(doc.id) ? prev.filter(id => id !== doc.id) : [...prev, doc.id])} className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"/>
                                          <span className="text-sm font-medium text-stone-700">{doc.name}</span>
                                      </label>
                                  ))}
                              </div>
                          }
                      </div>
                      {/* Regulatory Inputs Selection */}
                      <div className="p-6 bg-white shadow-lg rounded-lg border border-orange-200">
                          <h3 className="text-xl font-semibold text-stone-700 mb-3">2. Select Regulatory Inputs to Compare Against</h3>
                          {userAustracContent.length === 0 ? <p className="text-sm text-stone-500">Please add content on the "Regulatory Input" tab first.</p> :
                              <div className="max-h-60 overflow-y-auto space-y-2 p-2 border rounded-md bg-orange-50/50">
                                  {userAustracContent.map(item => (
                                      <label key={item.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-orange-100 cursor-pointer">
                                          <input type="checkbox" checked={selectedRegulatoryIdsForGapReview.includes(item.id)} onChange={() => setSelectedRegulatoryIdsForGapReview(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id])} className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"/>
                                          <span className="text-sm font-medium text-stone-700">{item.title}</span>
                                      </label>
                                  ))}
                              </div>
                          }
                      </div>
                  </div>
              )}
              
              {(fetchStatus === FetchState.IDLE || fetchStatus === FetchState.ERROR) && !challengeResult && (
                  <div className="text-center">
                       <button onClick={() => generateGapReview(selectedRegulatoryIdsForGapReview, selectedCompanyDocIdsForGapReview)} disabled={!ai || selectedCompanyDocIdsForGapReview.length === 0 || selectedRegulatoryIdsForGapReview.length === 0} className="bg-orange-500 hover:bg-orange-600 disabled:bg-stone-300 text-white font-bold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition text-lg">
                          Run Gap Review Analysis
                       </button>
                  </div>
              )}
              
              {fetchStatus === FetchState.LOADING && (
                  <div className="text-center py-12">
                      <LoadingSpinner size="lg" color="text-orange-500" />
                      <p className="mt-4 text-xl text-stone-600">{challengeNotification || "Running Gap Review, please wait..."}</p>
                  </div>
              )}

              {fetchStatus === FetchState.SUCCESS && challengeResult && (
                <div className="mt-6 bg-white shadow-xl rounded-lg border border-orange-200 p-6 md:p-8">
                  {Object.entries(challengeResult.groupedSuggestions || {}).map(([docName, changes]) => (
                    <section key={docName} className="mb-12">
                      <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-500 mb-6 border-b-2 border-orange-200 pb-2">
                        Suggestions for: {docName}
                      </h3>
                      <div className="space-y-6">
                        {changes.map(change => (
                          <SuggestedChangeCard key={change.id} change={change} renderPriorityBadge={renderPriorityBadge} onGenerateDraft={(changeToDraft) => handleGenerateDraft(changeToDraft, docName)} onDiscussInChat={handleDiscussInChat} isDraftingEnabled={!!ai} onUpdateFeedback={handleUpdateSuggestedChangeFeedback} />
                        ))}
                      </div>
                    </section>
                  ))}

                  <section className="mb-6">
                    <h2 className="text-3xl font-semibold mb-6 text-orange-600 flex items-center justify-center">
                      {ICONS.clipboardList("w-8 h-8 mr-3 text-green-500")} Overall Action Plan
                    </h2>
                    <div className="space-y-6">
                        {challengeResult.action_plan.map(item => (
                            <ActionPlanItemCard key={item.id} item={item} renderPriorityBadge={renderPriorityBadge} onUpdateFeedback={handleUpdateActionPlanItemFeedback} />
                        ))}
                    </div>
                  </section>
                  {currentAnalysisPrompts && (
                    <PromptDisplay
                      systemPrompt={currentAnalysisPrompts.system}
                      userPrompt={currentAnalysisPrompts.user}
                    />
                  )}
                </div>
              )}

            </div>
          )}

        </div>
      </main>
      
      <DraftTextModal
        isOpen={showDraftModal}
        onClose={() => setShowDraftModal(false)}
        isLoading={isDraftingText}
        draftText={draftedTextContent}
        draftComparisonResult={draftDiffResult}
        originalTextForEditing={originalDocumentForDraft?.textContent || null}
        error={draftError}
        changeItem={currentDraftingChange}
        originalDocumentName={originalDocumentForDraft?.name || null}
        onSaveFinalDraftFeedback={currentDraftingChange?.id.startsWith('ddsc') ? handleUpdateDeepDiveChangeFeedback : handleUpdateSuggestedChangeFeedback}
      />

      <Footer />
    </div>
  );
};

export default App;