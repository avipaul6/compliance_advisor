






import React, { useState, useEffect } from 'react';
import { CompanyDocument, DeepDiveAnalysisResult, FetchState, GroundingMetadata, GroundingChunkWeb, UserFeedback, SuggestedChange, ActionPlanItem } from '../types';
import { ICONS } from '../constants.tsx';
import LoadingSpinner from './LoadingSpinner';
import ErrorDisplay from './ErrorDisplay';
import SuggestedChangeCard from './SuggestedChangeCard';
import ActionPlanItemCard from './ActionPlanItemCard';
import PromptDisplay from './PromptDisplay';

interface DocumentDeepDivePageProps {
  companyDocs: CompanyDocument[];
  onStartDeepDive: (docId: string) => void;
  analysisResult: DeepDiveAnalysisResult | null;
  fetchStatus: FetchState;
  error: string | null;
  groundingMetadata: GroundingMetadata | null;
  isIngestionProcessing: boolean;
  notification: string | null;
  isAiReady: boolean;
  isViewingHistorical: boolean;
  currentAnalysisName: string | null;
  onClearView: () => void;
  renderPriorityBadge: (priority: 'High' | 'Medium' | 'Low') => React.ReactNode;
  onGenerateDraft: (change: SuggestedChange) => void;
  onDiscussInChat: (change: SuggestedChange) => void;
  onUpdateChangeFeedback: (itemId: string, feedbackUpdate: Partial<UserFeedback>) => void;
  onUpdateActionPlanFeedback: (itemId: string, feedbackUpdate: Partial<UserFeedback>) => void;
  isDraftingEnabled: boolean;
  prompts: { system: string; user: string } | null;
}

const DocumentDeepDivePage: React.FC<DocumentDeepDivePageProps> = ({
  companyDocs,
  onStartDeepDive,
  analysisResult,
  fetchStatus,
  error,
  groundingMetadata,
  isIngestionProcessing,
  notification,
  isAiReady,
  isViewingHistorical,
  currentAnalysisName,
  onClearView,
  renderPriorityBadge,
  onGenerateDraft,
  onDiscussInChat,
  onUpdateChangeFeedback,
  onUpdateActionPlanFeedback,
  isDraftingEnabled,
  prompts,
}) => {
  const [selectedDocId, setSelectedDocId] = useState<string>('');

  useEffect(() => {
    if (isViewingHistorical && analysisResult && companyDocs.length > 0) {
        const analyzedDoc = companyDocs.find(doc => doc.name === analysisResult.documentTitleAnalyzed);
        if (analyzedDoc) {
            setSelectedDocId(analyzedDoc.id);
        }
    }
  }, [isViewingHistorical, analysisResult, companyDocs]);


  const handleStartAnalysisClick = () => {
    if (selectedDocId) {
      onStartDeepDive(selectedDocId);
    }
  };

  const webSources = groundingMetadata?.groundingChunks?.filter(
    (chunk): chunk is { web: GroundingChunkWeb } => chunk.web !== undefined && chunk.web.uri !== undefined
  ).map(chunk => chunk.web);

  return (
    <div className="max-w-6xl mx-auto">
      {isViewingHistorical && (
        <div className="mb-4 p-3 bg-orange-100 border border-orange-300 rounded-lg text-sm text-orange-700 text-center">
          {ICONS.archiveBox("w-5 h-5 mr-2 inline-block")}
          Currently viewing historical deep dive: <strong>{currentAnalysisName || analysisResult?.documentTitleAnalyzed}</strong>.
          <button
            onClick={onClearView}
            className="ml-2 text-orange-600 hover:text-orange-800 underline text-xs"
          >
            (Clear View & Prepare New Deep Dive)
          </button>
        </div>
      )}

      {notification && (fetchStatus === FetchState.LOADING || isIngestionProcessing) && (
        <div className="mb-4 p-3 bg-orange-100 border border-orange-300 rounded-lg text-sm text-orange-700 text-center flex items-center justify-center">
          {ICONS.informationCircle("w-5 h-5 mr-2 inline-block")} {notification}
          <LoadingSpinner size="sm" color="text-orange-500" />
        </div>
      )}

      {!isViewingHistorical && (
        <>
        <div className="mb-6 p-4 bg-orange-100/50 border border-orange-200 rounded-lg text-sm text-orange-800">
            <h2 className="font-semibold text-lg mb-1">Purpose: Focused Document Audit</h2>
            <p>Use this tool for a <strong className="font-bold">detailed audit of a single company document</strong>. It acts like a <strong className="font-bold">microscope</strong>, checking one policy or procedure against all known regulations and best practices to assess its individual compliance and quality.</p>
        </div>

        <div className="mb-8 p-6 bg-white shadow-lg rounded-lg border border-orange-200">
          <h2 className="text-2xl font-semibold mb-4 text-orange-600 flex items-center">
            {ICONS.documentSearch("w-7 h-7 mr-3")}
            Select Document for Deep Dive
          </h2>
          <p className="text-sm text-stone-600 mb-4">
            Choose a company document for an in-depth analysis. The AI will review its content using its built-in compliance knowledge and Google Search to find potential enhancements and current best practices.
            <br/><br/>
            <span className="font-semibold text-orange-700">For a more tailored analysis,</span> you can upload specific laws and regulations in the 'Regulatory Input' tab, which the AI will then use as a primary reference.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-grow">
              <label htmlFor="deep-dive-doc-select" className="block text-sm font-medium text-stone-700 mb-1">
                Company Document
              </label>
              <select
                id="deep-dive-doc-select"
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="w-full p-2.5 bg-white border border-orange-300 rounded-md shadow-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-stone-800 disabled:bg-stone-100"
                disabled={fetchStatus === FetchState.LOADING || companyDocs.length === 0 || !isAiReady || isIngestionProcessing}
              >
                <option value="" disabled>
                  {companyDocs.length === 0 ? "Please upload company documents first" : "Select a document..."}
                </option>
                {companyDocs.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleStartAnalysisClick}
              disabled={!selectedDocId || fetchStatus === FetchState.LOADING || !isAiReady || isIngestionProcessing}
              className="bg-orange-500 hover:bg-orange-600 disabled:bg-stone-300 disabled:text-stone-500 text-white font-bold py-2.5 px-6 rounded-md shadow-md hover:shadow-lg transition duration-150 ease-in-out flex items-center justify-center"
              title={!selectedDocId ? "Please select a document first" : "Analyze Selected Document"}
            >
              {fetchStatus === FetchState.LOADING && !isViewingHistorical ? (
                <> <LoadingSpinner size="sm" color="text-white" /> <span className="ml-2">Analyzing...</span> </>
              ) : (
                "Analyze Selected Document"
              )}
            </button>
          </div>
          {error && fetchStatus === FetchState.ERROR && !isViewingHistorical && <ErrorDisplay message={error} className="mt-4" />}
        </div>
        </>
      )}

      {fetchStatus === FetchState.LOADING && !isViewingHistorical && (
        <div className="text-center py-12">
          <LoadingSpinner size="lg" color="text-orange-500" />
          <p className="mt-4 text-xl text-stone-600">Performing Deep Dive Analysis, please wait...</p>
        </div>
      )}
      
      {fetchStatus === FetchState.IDLE && !isViewingHistorical && companyDocs.length === 0 && (
        <div className="text-center py-12 bg-white p-8 rounded-lg border-2 border-dashed border-orange-300 shadow">
          {ICONS.folderOpen("w-16 h-16 mx-auto mb-6 text-orange-400 opacity-70")}
          <h2 className="text-2xl font-semibold text-stone-700 mb-3">No Company Documents Uploaded</h2>
          <p className="text-stone-600">
            Please go to the "Company Documents" tab to upload documents before starting a deep dive analysis.
          </p>
        </div>
      )}

      {fetchStatus === FetchState.SUCCESS && analysisResult && (
        <div className="mt-6 bg-white shadow-xl rounded-lg border border-orange-200 p-6 md:p-8">
          <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-500 mb-2 text-center">
            Deep Dive Analysis: {analysisResult.documentTitleAnalyzed}
          </h3>
          {isViewingHistorical && currentAnalysisName && currentAnalysisName !== analysisResult.documentTitleAnalyzed && (
             <p className="text-center text-xs text-stone-500 mb-4">(Saved as: "{currentAnalysisName}")</p>
          )}

          <section className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <h4 className="text-xl font-semibold text-stone-700 mb-2 border-b border-orange-200 pb-2">Overall Summary</h4>
            <p className="text-sm text-stone-600 whitespace-pre-wrap">{analysisResult.overallSummary || "Not provided."}</p>
          </section>

          {analysisResult.referencedRegulatoryInputs && (
            <section className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-lg">
                <h4 className="text-xl font-semibold text-stone-700 mb-3 border-b border-teal-200 pb-2 flex items-center">
                    {ICONS.bookOpen("w-5 h-5 mr-2 text-teal-600")}
                    Referenced Regulatory Inputs
                </h4>
                {analysisResult.referencedRegulatoryInputs.length > 0 ? (
                    <>
                        <p className="text-xs text-stone-600 mb-3">The AI's analysis was informed by the following specific documents from your Regulatory Input library (retrieved via simulated RAG):</p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-stone-600 pl-2">
                            {analysisResult.referencedRegulatoryInputs.map((docName, index) => (
                                <li key={`ref-input-${index}`}>{docName}</li>
                            ))}
                        </ul>
                    </>
                ) : (
                    <p className="text-sm text-stone-500 italic">No specific documents from your Regulatory Inputs were identified as highly relevant for this analysis. The AI proceeded using its general knowledge and web search capabilities.</p>
                )}
            </section>
          )}
          
          <section className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <h4 className="text-xl font-semibold text-stone-700 mb-3 border-b border-orange-200 pb-2">Key Themes & Topics</h4>
            {analysisResult.keyThemesAndTopics && analysisResult.keyThemesAndTopics.length > 0 ? (
              <ul className="list-disc list-inside space-y-1 text-sm text-stone-600 pl-2">
                {analysisResult.keyThemesAndTopics.map((theme, index) => (
                  <li key={`theme-${index}`}>{theme}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone-500 italic">No specific key themes identified.</p>
            )}
          </section>

          <section className="mb-12" aria-labelledby="suggested-changes-heading">
            <h2 id="suggested-changes-heading" className="text-3xl font-semibold mb-6 text-orange-600 flex items-center justify-center">
              {ICONS.lightBulb("w-8 h-8 mr-3 text-amber-500")} Suggested Changes
            </h2>
            {analysisResult.suggested_changes && analysisResult.suggested_changes.length > 0 ? (
              <div className="space-y-6">
                {analysisResult.suggested_changes.map((change) => (
                  <SuggestedChangeCard
                    key={change.id}
                    change={change}
                    renderPriorityBadge={renderPriorityBadge}
                    onGenerateDraft={onGenerateDraft}
                    onDiscussInChat={onDiscussInChat}
                    isDraftingEnabled={isDraftingEnabled}
                    onUpdateFeedback={onUpdateChangeFeedback}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-stone-500 bg-orange-50/50 rounded-lg border border-dashed border-orange-200">
                <p>No specific changes were suggested for this document.</p>
              </div>
            )}
          </section>
          
          <section className="mb-6" aria-labelledby="action-plan-heading">
            <h2 id="action-plan-heading" className="text-3xl font-semibold mb-6 text-orange-600 flex items-center justify-center">
              {ICONS.clipboardList("w-8 h-8 mr-3 text-green-500")} Action Plan
            </h2>
            {analysisResult.action_plan && analysisResult.action_plan.length > 0 ? (
              <div className="space-y-6">
                {analysisResult.action_plan.map((item) => (
                  <ActionPlanItemCard
                    key={item.id}
                    item={item}
                    renderPriorityBadge={renderPriorityBadge}
                    onUpdateFeedback={onUpdateActionPlanFeedback}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-stone-500 bg-orange-50/50 rounded-lg border border-dashed border-orange-200">
                <p>No specific action plan items were generated for this document.</p>
              </div>
            )}
          </section>
          
          {analysisResult.additionalObservations && (
            <section className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <h4 className="text-xl font-semibold text-stone-700 mb-2 border-b border-orange-200 pb-2">Additional Observations</h4>
              <p className="text-sm text-stone-600 whitespace-pre-wrap">{analysisResult.additionalObservations}</p>
            </section>
          )}

          {webSources && webSources.length > 0 && (
            <section className="mt-8 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <h4 className="text-xl font-semibold text-stone-700 mb-2 border-b border-orange-200 pb-2 flex items-center">
                {ICONS.link("w-5 h-5 mr-2 text-orange-500")}
                Trust & Transparency: Web Resources Used
                </h4>
                <p className="text-xs text-stone-600 mb-3">To ensure up-to-date analysis, the AI grounded its suggestions in the following public web pages found via Google Search. You can click to verify these sources.</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                    {webSources.map((source, index) => (
                    <li key={`web-source-${index}`}>
                        <a
                        href={source.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:text-orange-800 hover:underline"
                        title={source.uri}
                        >
                        {source.title || source.uri}
                        </a>
                    </li>
                    ))}
                </ul>
            </section>
          )}
          {prompts && (
            <PromptDisplay
              systemPrompt={prompts.system}
              userPrompt={prompts.user}
            />
          )}
           {error && fetchStatus === FetchState.SUCCESS && <ErrorDisplay message={error} className="mt-4" />}
        </div>
      )}
       {fetchStatus === FetchState.ERROR && error && isViewingHistorical && (
          <div className="mt-6"> <ErrorDisplay message={error} /></div>
      )}
    </div>
  );
};

export default DocumentDeepDivePage;