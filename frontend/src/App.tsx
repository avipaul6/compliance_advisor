import React, { useState, useCallback, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { diffWordsWithSpace, type Change } from 'diff'; 
import { AustracUpdate, ChallengeAnalysisResult, GroundingMetadata, CompanyDocument, FetchState, SuggestedChange, ActionPlanItem, UserFeedback, SavedAnalysis, DocumentChunk, DeepDiveAnalysisResult } from './types'; 
import { 
    ICONS, CHAT_HISTORY_KEY, INTERNAL_CORPUS_KEY, USER_AUSTRAC_CONTENT_KEY, 
    SAVED_ANALYSES_KEY, ACTIVE_ANALYSIS_ID_KEY, CHATBOT_LEARNINGS_KEY,
} from './constants'; 
import { generateUniqueId, formatBytes } from './utils';
import { 
    ingestDocumentsInBackend,
    generateGapReviewInBackend,
    generateDeepDiveInBackend,
    sendChatMessageToBackend,
    generateDraftInBackend
} from './ragService'; 
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
import DocumentIndexDashboard from './components/DocumentIndexDashboard';


// Correctly set the worker URL for Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();


const App: React.FC = () => {
  // AI client and API key state are removed, as this is now a backend concern.
  
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
  // Initial error about API_KEY is removed.
  const [error, setError] = useState<string | null>(null);
    
  // Chat state is simplified. No more direct chat object from the SDK.
  const [chatMessages, setChatMessages] = useState<{sender: 'user' | 'model', text: string, grounding?: GroundingMetadata, retrievedContext?: DocumentChunk[]}[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'challenge' | 'deepDive' | 'austracInputs' | 'companyDocs' | 'indexStatus' | 'chat' | 'history'>('challenge');

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
    // AI initialization is removed. Assume backend is ready.

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

  useEffect(() => { if (internalCorpus.length > 0) localStorage.setItem(INTERNAL_CORPUS_KEY, JSON.stringify(internalCorpus)); else if (localStorage.getItem(INTERNAL_CORPUS_KEY)) localStorage.removeItem(INTERNAL_CORPUS_KEY); }, [internalCorpus]);
  useEffect(() => { if (userAustracContent.length > 0) localStorage.setItem(USER_AUSTRAC_CONTENT_KEY, JSON.stringify(userAustracContent)); else if (localStorage.getItem(USER_AUSTRAC_CONTENT_KEY)) localStorage.removeItem(USER_AUSTRAC_CONTENT_KEY); }, [userAustracContent]);
  
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
    setIsIngestionProcessing(true);
    setIngestionStatus('Preparing to ingest documents...');
    setError(null);

    const documentsToProcess = [
      ...internalCorpus,
      ...userAustracContent
    ].filter(doc => forceReprocessAll || !doc.isProcessedForRag);

    if (documentsToProcess.length === 0 && !forceReprocessAll) {
        setIngestionStatus("All documents are already marked as ingested on the frontend.");
        setIsIngestionProcessing(false);
        setTimeout(() => setIngestionStatus(''), 5000);
        return;
    }

    try {
        setIngestionStatus(`Sending ${documentsToProcess.length} document(s) to backend for ingestion...`);
        const result = await ingestDocumentsInBackend(documentsToProcess);

        if (result.success) {
            // Mark all documents as processed on the frontend for visual feedback
            const processedIds = new Set(documentsToProcess.map(d => d.id));
            setInternalCorpus(prev => prev.map(d => processedIds.has(d.id) ? {...d, isProcessedForRag: true} : d));
            setUserAustracContent(prev => prev.map(u => processedIds.has(u.id) ? {...u, isProcessedForRag: true} : u));
            setIngestionStatus(result.message || `Backend successfully processed ${documentsToProcess.length} document(s).`);
        } else {
            setError(`Backend ingestion failed: ${result.message}`);
            setIngestionStatus('Backend ingestion failed.');
        }
    } catch (ingestionError) {
        setError(`Error during ingestion: ${(ingestionError as Error).message}`);
        setIngestionStatus('Error communicating with backend for ingestion.');
    } finally {
        setIsIngestionProcessing(false);
        setTimeout(() => setIngestionStatus(''), 5000); 
    }
  }, [internalCorpus, userAustracContent]);


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
  
  // Chat logic is simplified, as the backend now manages the session.
  useEffect(() => {
    // This effect can be used to set an initial welcome message if the chat is empty.
    if (activeTab === 'chat' && chatMessages.length === 0) {
       setChatMessages([{ sender: 'user', text: "Chat session started. How can I help with compliance?" },{ sender: 'model', text: `I am ready to assist. I have access to your uploaded and ingested documents.` }]);
    }
  }, [activeTab, chatMessages.length]);

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const currentMessage = chatInput.trim();
    const currentHistory = chatMessages.map(({sender, text}) => ({sender, text})); // Strip other fields for backend

    setChatMessages(prev => [...prev, { sender: 'user', text: currentMessage }]);
    setChatInput('');
    setIsChatLoading(true);
    setError(null); 
    setDeepDiveError(null); 
    setIngestionStatus(''); 

    // Add a thinking indicator immediately.
    const thinkingMessage = { sender: 'model' as const, text: 'Thinking...' };
    setChatMessages(prev => [...prev, thinkingMessage]);

    try {
      const response = await sendChatMessageToBackend({
          message: currentMessage,
          history: currentHistory,
          context: {
              allCompanyDocs: internalCorpus,
              allAustracContent: userAustracContent,
              savedAnalyses,
              activeAnalysisId
          }
      });
      
      // Replace the "Thinking..." message with the actual response
      setChatMessages(prev => {
          const newMessages = [...prev];
          const thinkingIndex = newMessages.findIndex(m => m.text === 'Thinking...');
          if (thinkingIndex !== -1) {
              newMessages[thinkingIndex] = { sender: 'model', text: response.text, grounding: response.grounding, retrievedContext: response.retrievedContext };
          } else {
              // Should not happen, but as a fallback
              newMessages.push({ sender: 'model', text: response.text, grounding: response.grounding, retrievedContext: response.retrievedContext });
          }
          return newMessages;
      });

    } catch (e) {
      const errorMsg = `Error sending message: ${(e as Error).message}`;
      setError(errorMsg); 
       // Replace the "Thinking..." message with the error
       setChatMessages(prev => {
        const newMessages = [...prev];
        const thinkingIndex = newMessages.findIndex(m => m.text === 'Thinking...');
        if (thinkingIndex !== -1) {
            newMessages[thinkingIndex] = { sender: 'model', text: `Sorry, I encountered an error: ${errorMsg}` };
        } else {
            newMessages.push({ sender: 'model', text: `Sorry, I encountered an error: ${errorMsg}` });
        }
        return newMessages;
    });
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleClearChat = () => { 
    setChatMessages([]); 
    localStorage.removeItem(CHAT_HISTORY_KEY);
  };

  const handleShowSystemPrompt = () => { 
     setChatMessages(prev => [ ...prev, { sender: 'user', text: "[System Query: Show current bot instructions]" }, { sender: 'model', text: "The bot's instructions (system prompt) are now managed by the Python backend. The backend constructs the prompt dynamically based on the documents you've provided and your interaction history to ensure the most relevant and secure processing." } ]); 
  };
  
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
    if (companyDocIds.length === 0 || targetRegulatoryIds.length === 0) {
      setError("Please select at least one Company Document AND at least one Regulatory Input to target for the Gap Review.");
      setFetchStatus(FetchState.IDLE);
      return;
    }

    setFetchStatus(FetchState.LOADING);
    setError(null);
    setChallengeResult(null);
    setSummarizedUserAustracUpdates([]);
    setCurrentInputsForChallenge({companyDocs: [], austracContent: []});
    setActiveAnalysisId(null);
    setChallengeNotification("Sending request to backend for Gap Review analysis...");
    setCurrentAnalysisPrompts(null);
    setDeepDiveAnalysisNotification(null);

    try {
        setChallengeNotification("Backend is processing... This may take a moment.");
        
        const newSavedAnalysis = await generateGapReviewInBackend({
            targetRegulatoryIds,
            companyDocIds,
            allAustracContent: userAustracContent,
            allCompanyDocs: internalCorpus,
            savedAnalyses
        });

        // The backend returns the complete, ready-to-use SavedAnalysis object
        setChallengeResult(newSavedAnalysis.challengeAnalysisResult!);
        setSummarizedUserAustracUpdates(newSavedAnalysis.summarizedAustracUpdatesSnapshot || []);
        setCurrentInputsForChallenge({ 
            companyDocs: newSavedAnalysis.companyDocumentsUsedSnapshot || [],
            austracContent: newSavedAnalysis.austracInputsUsedSnapshot || []
        });
        if (newSavedAnalysis.systemPrompt && newSavedAnalysis.userPrompt) {
            setCurrentAnalysisPrompts({ system: newSavedAnalysis.systemPrompt, user: newSavedAnalysis.userPrompt });
        }
        setSavedAnalyses(prev => [newSavedAnalysis, ...prev].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        setActiveAnalysisId(newSavedAnalysis.id);
        
        setFetchStatus(FetchState.SUCCESS);
        setChallengeNotification(null);
        setSelectedRegulatoryIdsForGapReview([]);
        setSelectedCompanyDocIdsForGapReview([]);

    } catch (e) {
      console.error("Error generating Gap Review from backend:", e);
      setError(`An error occurred while generating the Gap Review: ${(e as Error).message}`);
      setFetchStatus(FetchState.ERROR);
      setChallengeNotification(null);
    }
  }, [userAustracContent, internalCorpus, savedAnalyses]);

  const generateDeepDive = useCallback(async (docId: string) => {
    const targetDoc = internalCorpus.find(doc => doc.id === docId);
    if (!targetDoc) { setDeepDiveError("Target document not found."); setDeepDiveFetchStatus(FetchState.ERROR); return; }

    setDeepDiveFetchStatus(FetchState.LOADING);
    setDeepDiveError(null); setDeepDiveResult(null); setActiveAnalysisId(null); setDeepDiveAnalysisNotification("Sending request to backend for Deep Dive analysis..."); setChallengeNotification(null); setCurrentAnalysisPrompts(null);
    
    try {
        setDeepDiveAnalysisNotification("Backend is processing... This may take a moment.");
        
        const newSavedAnalysis = await generateDeepDiveInBackend({
            docId,
            allCompanyDocs: internalCorpus,
            allAustracContent: userAustracContent,
        });

        setDeepDiveResult(newSavedAnalysis.deepDiveAnalysisResult!);
        setSelectedDocForDeepDiveId(newSavedAnalysis.selectedDocumentSnapshot?.id || null);
        setDeepDiveGroundingMetadata(newSavedAnalysis.groundingMetadata || null);
        if (newSavedAnalysis.systemPrompt && newSavedAnalysis.userPrompt) {
          setCurrentAnalysisPrompts({ system: newSavedAnalysis.systemPrompt, user: newSavedAnalysis.userPrompt });
        }
        
        setSavedAnalyses(prev => [newSavedAnalysis, ...prev].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        setActiveAnalysisId(newSavedAnalysis.id);

        setDeepDiveFetchStatus(FetchState.SUCCESS);

    } catch (e) {
        console.error("Error generating Deep Dive from backend:", e);
        setDeepDiveError(`An error occurred during the Deep Dive: ${(e as Error).message}`);
        setDeepDiveFetchStatus(FetchState.ERROR);
    } finally {
        setDeepDiveAnalysisNotification(null);
    }
  }, [internalCorpus, userAustracContent]);

  const handleGenerateDraft = useCallback(async (changeToDraft: SuggestedChange, docNameFromContext?: string) => {
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

    try {
        const result = await generateDraftInBackend({
            changeToDraft,
            originalDocument: originalDoc
        });
        const newDraft = result.newDraft;
        setDraftedTextContent(newDraft);
        setDraftDiffResult(diffWordsWithSpace(originalDoc.textContent, newDraft));
    } catch (e) {
        setDraftError(`Failed to generate draft text from backend: ${(e as Error).message}`);
    } finally {
        setIsDraftingText(false);
    }
  }, [internalCorpus, deepDiveResult]);

  const handleClearDeepDiveView = () => {
    setActiveAnalysisId(null);
    setDeepDiveResult(null);
    setSelectedDocForDeepDiveId('');
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
        setSelectedDocForDeepDiveId('');
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
    { id: 'indexStatus', name: 'RAG Index', icon: ICONS.database }, 
    { id: 'chat', name: 'Compliance Chatbot', icon: ICONS.chatBubbleLeftRight },
    { id: 'history', name: 'Analysis History', icon: ICONS.archiveBox },
  ];
  
  // The isAiReady prop is now effectively always true, as we assume the backend is running.
  const isAiReady = true;

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
              isAiReady={isAiReady}
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
              isAiReady={isAiReady}
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
                    {isChatLoading && chatMessages[chatMessages.length - 1]?.text !== 'Thinking...' && (
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
                        disabled={isChatLoading || isIngestionProcessing}
                    />
                    <button onClick={handleChatSubmit} disabled={isChatLoading || !chatInput.trim() || isIngestionProcessing} className="bg-orange-500 text-white px-5 py-2 rounded-lg font-semibold hover:bg-orange-600 disabled:bg-stone-300">Send</button>
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
                isAiReady={isAiReady}
                isViewingHistorical={!!activeAnalysisId && savedAnalyses.find(sa => sa.id === activeAnalysisId)?.type === 'deepDive'}
                currentAnalysisName={activeAnalysisId ? savedAnalyses.find(sa => sa.id === activeAnalysisId)?.name || null : null}
                onClearView={handleClearDeepDiveView}
                renderPriorityBadge={renderPriorityBadge}
                onGenerateDraft={handleGenerateDraft}
                onDiscussInChat={handleDiscussInChat}
                onUpdateChangeFeedback={handleUpdateDeepDiveChangeFeedback}
                onUpdateActionPlanFeedback={handleUpdateDeepDiveActionPlanFeedback}
                isDraftingEnabled={isAiReady}
                prompts={currentAnalysisPrompts}
             />
          )}

          {activeTab === 'indexStatus' && (
              <DocumentIndexDashboard className="mt-6" />
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
                       <button onClick={() => generateGapReview(selectedRegulatoryIdsForGapReview, selectedCompanyDocIdsForGapReview)} disabled={!isAiReady || selectedCompanyDocIdsForGapReview.length === 0 || selectedRegulatoryIdsForGapReview.length === 0} className="bg-orange-500 hover:bg-orange-600 disabled:bg-stone-300 text-white font-bold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition text-lg">
                          Run Gap Review Analysis
                       </button>
                  </div>
              )}
              
              {fetchStatus === FetchState.LOADING && (
                  <div className="text-center py-12">
                      <LoadingSpinner size="lg" color="text-orange-500" />
                      <p className="mt-4 text-xl text-stone-600">{challengeNotification || "Contacting backend for Gap Review..."}</p>
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
                          <SuggestedChangeCard key={change.id} change={change} renderPriorityBadge={renderPriorityBadge} onGenerateDraft={(changeToDraft) => handleGenerateDraft(changeToDraft, docName)} onDiscussInChat={handleDiscussInChat} isDraftingEnabled={isAiReady} onUpdateFeedback={handleUpdateSuggestedChangeFeedback} />
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