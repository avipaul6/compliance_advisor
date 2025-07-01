import React, { useState } from 'react';
import { AustracUpdate } from '../types';
import { ICONS } from '../constants.tsx';
import LoadingSpinner from './LoadingSpinner';
import { parseFileContent, generateUniqueId, ParsedFileData } from '../utils';
import AustracUpdateCard from './AustracUpdateCard';

interface AustracInputsPageProps {
  userAustracContent: AustracUpdate[];
  setUserAustracContent: React.Dispatch<React.SetStateAction<AustracUpdate[]>>;
  onIngestAll: (forceReprocess: boolean) => void;
  isIngestionProcessing: boolean;
  ingestionStatus: string;
  totalDocs: number;
  ingestedDocsCount: number;
  allDocsIngested: boolean;
  isAiReady: boolean;
}

const AustracInputsPage: React.FC<AustracInputsPageProps> = ({ 
    userAustracContent, 
    setUserAustracContent,
    onIngestAll,
    isIngestionProcessing,
    ingestionStatus,
    totalDocs,
    ingestedDocsCount,
    allDocsIngested,
    isAiReady
}) => {
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsingFileName, setParsingFileName] = useState<string | null>(null);

  const [pastedTitle, setPastedTitle] = useState<string>('');
  const [pastedContent, setPastedContent] = useState<string>('');
  const [pastedError, setPastedError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsParsing(true);
    setParseError(null);
    const newUpdates: AustracUpdate[] = [];
    let errorsEncountered: string[] = [];

    for (const file of Array.from(files)) {
      setParsingFileName(file.name);
      try {
        if (file.type !== 'application/pdf' && file.type !== 'text/plain') {
          errorsEncountered.push(`Unsupported file type for ${file.name}: ${file.type}. Please upload PDF or TXT files.`);
          continue;
        }
        const parsedData: ParsedFileData = await parseFileContent(file);
        const newUpdate: AustracUpdate = {
          id: `${parsedData.name}-${new Date(parsedData.lastModified).getTime()}-${parsedData.size}-${generateUniqueId().substring(0,5)}`, 
          title: parsedData.name,
          rawContent: parsedData.textContent,
          type: parsedData.type as 'pdf' | 'txt',
          dateAdded: new Date().toISOString(),
          isProcessedForRag: false,
        };
        
        // BUG FIX: Removed redundant check against `newUpdates` array.
        if (!userAustracContent.some(upd => upd.id === newUpdate.id)) {
          newUpdates.push(newUpdate);
        } else {
           console.warn(`Skipping duplicate AUSTRAC file (or file with potential ID collision): ${file.name}`);
           errorsEncountered.push(`File ${file.name} might be a duplicate or caused an ID collision and was skipped. Try renaming if it's a different file.`);
        }
      } catch (err) {
        errorsEncountered.push((err as Error).message);
      }
    }
    
    if (newUpdates.length > 0) {
        setUserAustracContent(prevUpdates => [...prevUpdates, ...newUpdates]);
    }
    if (errorsEncountered.length > 0) {
        setParseError(errorsEncountered.join('\n'));
    }

    setIsParsing(false);
    setParsingFileName(null);
    event.target.value = ''; 
  };

  const handleAddPastedText = () => {
    setPastedError(null);
    if (!pastedTitle.trim()) { setPastedError("Title for pasted text cannot be empty."); return; }
    if (!pastedContent.trim()) { setPastedError("Content for pasted text cannot be empty."); return; }

    const newUpdate: AustracUpdate = {
      id: `pasted-${generateUniqueId()}`, 
      title: pastedTitle.trim(),
      rawContent: pastedContent.trim(),
      type: 'pasted',
      dateAdded: new Date().toISOString(),
      isProcessedForRag: false,
    };
    
    // BUG FIX: Removed check for duplicate titles, allowing multiple entries with the same title.
    setUserAustracContent(prevUpdates => [...prevUpdates, newUpdate]);
    setPastedTitle('');
    setPastedContent('');
  };

  const handleRemoveAustracItem = (itemId: string) => {
    setUserAustracContent(prevUpdates => prevUpdates.filter(upd => upd.id !== itemId));
  };

  const uningestedCount = totalDocs - ingestedDocsCount;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 bg-white shadow-xl rounded-lg border border-orange-200">
      <h2 className="text-3xl font-semibold mb-6 text-orange-600 flex items-center justify-center">
        {ICONS.bookOpen("w-8 h-8 mr-3 text-orange-500")} 
        Manage Regulatory Input
      </h2>
      
      <p className="text-stone-600 mb-6">
        Upload regulatory documents (e.g., from AUSTRAC, government gazettes) as PDF or TXT files, or paste raw text. 
        These inputs can then be used in a "Gap Review". To make them available for the Chatbot, ingest them on the "Company Documents" page.
      </p>

      {/* File Upload Section */}
      <div className="mb-8 p-6 bg-orange-50 rounded-lg border border-orange-200">
        <h3 className="text-xl font-semibold text-stone-700 mb-3">Upload New Regulatory Files</h3>
        <label htmlFor="austrac-file-upload" className={`inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-orange-50 focus:ring-orange-500 cursor-pointer transition-colors
            ${isParsing ? 'bg-stone-300 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'}`}>
          {ICONS.arrowUpTray("w-5 h-5 mr-2")}
          Choose Regulatory Files (.pdf, .txt)
        </label>
        <input 
          id="austrac-file-upload" 
          name="austrac-file-upload" 
          type="file" 
          className="sr-only" 
          multiple 
          accept=".pdf,.txt,text/plain,application/pdf"
          onChange={handleFileChange}
          disabled={isParsing}
        />
        {isParsing && parsingFileName && (
          <div className="mt-4 flex items-center text-orange-600">
            <LoadingSpinner size="sm" color="text-orange-500"/>
            <span className="ml-2">Parsing {parsingFileName}...</span>
          </div>
        )}
        {parseError && (
          <div className="mt-4 bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg" role="alert">
            <strong className="font-semibold">Error during file upload:</strong>
            <pre className="whitespace-pre-wrap text-sm">{parseError}</pre>
          </div>
        )}
      </div>

      {/* Paste Text Section */}
      <div className="mb-8 p-6 bg-orange-50 rounded-lg border border-orange-200">
        <h3 className="text-xl font-semibold text-stone-700 mb-3">Paste Regulatory Text</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="pastedTitle" className="block text-sm font-medium text-stone-600 mb-1">Title for Pasted Content</label>
            <input
              type="text"
              id="pastedTitle"
              value={pastedTitle}
              onChange={(e) => setPastedTitle(e.target.value)}
              className="w-full p-2.5 bg-white border border-orange-300 rounded-md shadow-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-stone-800 placeholder-stone-400"
              placeholder="e.g., Regulatory Guidance Note July 2024"
              disabled={isParsing}
              aria-required="true"
            />
          </div>
          <div>
            <label htmlFor="pastedContent" className="block text-sm font-medium text-stone-600 mb-1">Pasted Regulatory Content</label>
            <textarea
              id="pastedContent"
              rows={8}
              value={pastedContent}
              onChange={(e) => setPastedContent(e.target.value)}
              className="w-full p-2.5 bg-white border border-orange-300 rounded-md shadow-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-stone-800 placeholder-stone-400 resize-y"
              placeholder="Paste the full text of the regulatory update or guidance here..."
              disabled={isParsing}
              aria-required="true"
            />
          </div>
          <button
            onClick={handleAddPastedText}
            disabled={isParsing || !pastedTitle.trim() || !pastedContent.trim()}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-stone-300 disabled:text-stone-500 text-white font-medium rounded-md shadow-sm transition-colors"
          >
            Add Pasted Text
          </button>
          {pastedError && (
            <div className="mt-2 bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded-md text-sm" role="alert">
              {pastedError}
            </div>
          )}
        </div>
      </div>

      {/* Ingestion Section */}
       <div className="mb-8 p-6 bg-green-50 rounded-lg border border-green-200">
          <h3 className="text-xl font-semibold text-stone-700 mb-2 flex items-center">
            {ICONS.cpuChip("w-6 h-6 mr-2 text-green-600")}
            Vertex AI RAG Ingestion
          </h3>
          <p className="text-sm text-stone-600 mb-4">
            Process all uploaded documents (Company and Regulatory) to make them searchable by the AI for analysis and chat. This is a simulation of adding them to a Vector Database.
             <span className="font-semibold block mt-1">{ingestedDocsCount} of {totalDocs} total documents are currently ingested.</span>
          </p>
          
          {isIngestionProcessing ? (
            <div className="flex items-center text-orange-600 p-2">
              <LoadingSpinner size="sm" color="text-orange-500"/>
              <span className="ml-2 font-medium">{ingestionStatus || "Processing documents..."}</span>
            </div>
          ) : (
            <button
              onClick={() => onIngestAll(allDocsIngested)}
              disabled={!isAiReady || isIngestionProcessing || totalDocs === 0}
              className={`inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-green-50 transition-colors
                ${allDocsIngested ? 'bg-green-600 hover:bg-green-700 focus:ring-green-600' : 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500'}
                ${!isAiReady || isIngestionProcessing || totalDocs === 0 ? 'bg-stone-300 cursor-not-allowed' : ''}`}
            >
              {ICONS.cloudArrowUp("w-5 h-5 mr-2")}
              {allDocsIngested && totalDocs > 0 ? `Re-process all ${totalDocs} documents` : (uningestedCount > 0 ? `Ingest ${uningestedCount} un-processed document(s)` : 'All documents ingested')}
            </button>
          )}

          {ingestionStatus && !isIngestionProcessing && (
            <p className="text-xs text-green-700 mt-3 bg-green-100 p-2 rounded-md">{ingestionStatus}</p>
          )}
           {!isAiReady && <p className="text-xs text-red-600 mt-2">AI is not ready. Check API Key configuration.</p>}
        </div>

      {/* List of AUSTRAC Content */}
      <div>
        <h3 className="text-2xl font-semibold text-stone-700 mb-4">Your Regulatory Content</h3>
        {userAustracContent.length === 0 ? (
          <div className="text-center py-8 text-stone-500 border-2 border-dashed border-orange-200 rounded-lg bg-orange-50/50">
            {ICONS.bookOpen("w-12 h-12 mx-auto mb-3 opacity-40 text-orange-400")}
            <p className="font-medium">No regulatory content added yet.</p>
            <p className="text-sm">Upload files or paste text above to build your regulatory knowledge base for analysis.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {userAustracContent.map(item => (
              <AustracUpdateCard 
                key={item.id}
                item={item}
                onRemove={handleRemoveAustracItem}
                disabled={isParsing}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AustracInputsPage;
