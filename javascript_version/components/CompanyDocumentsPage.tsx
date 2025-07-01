



import React, { useState } from 'react';
import { CompanyDocument } from '../types'; 
import { ICONS } from '../constants.tsx';
import LoadingSpinner from './LoadingSpinner';
import { parseFileContent, formatBytes, generateUniqueId, ParsedFileData } from '../utils';

interface CompanyDocumentsPageProps {
  companyDocs: CompanyDocument[];
  setCompanyDocs: React.Dispatch<React.SetStateAction<CompanyDocument[]>>;
  onIngestAll: (forceReprocess: boolean) => void;
  isIngestionProcessing: boolean;
  ingestionStatus: string;
  totalDocs: number;
  ingestedDocsCount: number;
  allDocsIngested: boolean;
  isAiReady: boolean;
}

const CompanyDocumentsPage: React.FC<CompanyDocumentsPageProps> = ({ 
  companyDocs, 
  setCompanyDocs,
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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsParsing(true);
    setParseError(null);
    const newDocs: CompanyDocument[] = [];
    let errorsEncountered: string[] = [];

    for (const file of Array.from(files)) {
      setParsingFileName(file.name);
      try {
        if (file.type !== 'application/pdf' && file.type !== 'text/plain') {
          errorsEncountered.push(`Unsupported file type for ${file.name}: ${file.type}. Please upload PDF or TXT files.`);
          continue;
        }
        const parsedData: ParsedFileData = await parseFileContent(file);
        const newDoc: CompanyDocument = {
          id: `${parsedData.name}-${parsedData.lastModified}-${parsedData.size}-${generateUniqueId().substring(0,5)}`, 
          name: parsedData.name,
          textContent: parsedData.textContent,
          type: parsedData.type as 'pdf' | 'txt' | 'generic',
          lastModified: parsedData.lastModified,
          size: parsedData.size,
          isProcessedForRag: false, // Initialize RAG status (not yet ingested to Vertex AI)
        };
        
        // BUG FIX: Removed redundant check against `newDocs` array.
        if (!companyDocs.some(doc => doc.id === newDoc.id)) {
          newDocs.push(newDoc);
        } else {
          console.warn(`Skipping duplicate file (or file with potential ID collision): ${file.name}`);
           errorsEncountered.push(`File ${file.name} might be a duplicate or caused an ID collision and was skipped. Try renaming if it's a different file.`);
        }
      } catch (err) {
        errorsEncountered.push((err as Error).message);
      }
    }
    
    if (newDocs.length > 0) {
        setCompanyDocs(prevDocs => [...prevDocs, ...newDocs]);
    }
    if (errorsEncountered.length > 0) {
        setParseError(errorsEncountered.join('\n'));
    }

    setIsParsing(false);
    setParsingFileName(null);
    event.target.value = ''; 
  };

  const handleRemoveDocument = (docId: string) => {
    setCompanyDocs(prevDocs => prevDocs.filter(doc => doc.id !== docId));
  };
  
  const uningestedCount = totalDocs - ingestedDocsCount;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 bg-white shadow-xl rounded-lg border border-orange-200">
      <h2 className="text-3xl font-semibold mb-6 text-orange-600 flex items-center justify-center">
        {ICONS.folder("w-8 h-8 mr-3 text-orange-500")} 
        Company Documents (Internal Corpus)
      </h2>
      
      <p className="text-stone-600 mb-6">
        Upload all relevant internal documents (PDF or TXT). These documents form your organization's knowledge base.
        After uploading, you must "ingest" them to make them available to the AI for analysis and chat.
      </p>

      <div className="mb-8 p-6 bg-orange-50 rounded-lg border border-orange-200">
        <h3 className="text-xl font-semibold text-stone-700 mb-3">Upload New Documents</h3>
        <label htmlFor="company-file-upload" className={`inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-orange-50 focus:ring-orange-500 cursor-pointer transition-colors
            ${isParsing ? 'bg-stone-300 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'}`}>
          {ICONS.arrowUpTray("w-5 h-5 mr-2")}
          Choose Files to Upload (.pdf, .txt)
        </label>
        <input 
          id="company-file-upload" 
          name="company-file-upload" 
          type="file" 
          className="sr-only" 
          multiple 
          accept=".pdf,.txt,text/plain,application/pdf"
          onChange={handleFileChange}
          disabled={isParsing || isIngestionProcessing}
        />
        {isParsing && parsingFileName && (
          <div className="mt-4 flex items-center text-orange-600">
            <LoadingSpinner size="sm" color="text-orange-500" />
            <span className="ml-2">Parsing {parsingFileName}...</span>
          </div>
        )}
        {parseError && (
          <div className="mt-4 bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg" role="alert">
            <strong className="font-semibold">Error during upload:</strong>
            <pre className="whitespace-pre-wrap text-sm">{parseError}</pre>
          </div>
        )}
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

      <div>
        <h3 className="text-2xl font-semibold text-stone-700 mb-4">Uploaded Company Documents</h3>
        {companyDocs.length === 0 ? (
          <div className="text-center py-8 text-stone-500 border-2 border-dashed border-orange-200 rounded-lg bg-orange-50/50">
            {ICONS.folderOpen("w-12 h-12 mx-auto mb-3 opacity-40 text-orange-400")}
            <p className="font-medium">No company documents uploaded yet.</p>
            <p className="text-sm">Upload documents to build your internal knowledge base for AI analysis.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {companyDocs.map(doc => (
              <li key={doc.id} className="bg-orange-50 p-4 rounded-lg flex justify-between items-center shadow-sm transition-all hover:bg-orange-100 border border-orange-200">
                <div className="flex items-center overflow-hidden">
                   {ICONS.documentText("w-6 h-6 mr-3 text-orange-500 flex-shrink-0")}
                  <div className="truncate">
                    <p className="font-medium text-stone-800 truncate" title={doc.name}>{doc.name}</p>
                    <div className="text-xs text-stone-500 flex items-center space-x-2 flex-wrap">
                        <span>Type: {doc.type.toUpperCase()}</span>
                        <span>Size: {formatBytes(doc.size)}</span>
                        <span>Added: {new Date(doc.lastModified).toLocaleDateString()}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-white text-xs ${doc.isProcessedForRag ? 'bg-green-500' : 'bg-amber-500'}`} title={doc.isProcessedForRag ? `Ingested to Vertex AI RAG (simulated)` : 'Not yet ingested to Vertex AI RAG (simulated)'}>
                           {doc.isProcessedForRag ? 'Vertex AI RAG Ready' : 'Needs Ingestion'}
                        </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveDocument(doc.id)}
                  title="Remove document"
                  className="p-2 rounded-md text-stone-500 hover:text-red-500 hover:bg-red-100 transition-colors flex-shrink-0 ml-2"
                  disabled={isParsing || isIngestionProcessing}
                  aria-label={`Remove document ${doc.name}`}
                >
                  {ICONS.trash("w-5 h-5")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CompanyDocumentsPage;