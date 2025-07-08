import React, { useState } from 'react';
import { AustracUpdate } from '../types';
import { ICONS } from '../constants';
import LoadingSpinner from './LoadingSpinner';
import { uploadService } from '../services/uploadService'; // Added import for uploadService
import { generateUniqueId } from '../utils'; // Keep this for pasted content
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

  // UPDATED: New handleFileChange using uploadService instead of local parsing
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsParsing(true);
    setParseError(null);
    
    try {
      console.log(`Starting upload of ${files.length} regulatory files to cloud storage...`);
      
      // Upload files using your existing uploadService with 'regulatory' type
      const results = await uploadService.uploadMultipleDocuments(
        files,
        'regulatory', // document type for AUSTRAC/regulatory files
        (fileName: string, progress: any) => {
          setParsingFileName(fileName);
          console.log(`Upload progress for ${fileName}:`, progress);
        }
      );

      // Process results
      const successfulUploads = results.filter(result => result.success);
      const failedUploads = results.filter(result => !result.success);

      if (failedUploads.length > 0) {
        const errorMessages = failedUploads.map(result => result.message).join('\n');
        setParseError(`Some uploads failed:\n${errorMessages}`);
      }

      if (successfulUploads.length > 0) {
        // Convert successful uploads to AustracUpdate format for your UI
        const newUpdates = successfulUploads.map((result, index) => ({
          id: result.document_id || `regulatory-upload-${Date.now()}-${index}`,
          title: result.metadata?.original_filename || `Regulatory Document ${index + 1}`,
          rawContent: '', // Content will be processed by Vertex AI in the cloud
          type: 'pdf' as const, // You can enhance this based on file extension
          dateAdded: new Date().toISOString(),
          isProcessedForRag: false, // Will be processed by cloud function
          // Add cloud storage metadata
          metadata: {
            file_path: result.file_path,
            storage_url: result.storage_url,
            document_id: result.document_id,
            ...result.metadata
          }
        }));

        // Add to existing regulatory content
        setUserAustracContent(prev => [...prev, ...newUpdates]);
        
        console.log(`✅ Successfully uploaded ${successfulUploads.length} regulatory documents to cloud storage`);
        
        // Show success message
        if (failedUploads.length === 0) {
          setParseError(null); // Clear any previous errors
        }
      }

    } catch (error) {
      console.error('Upload error:', error);
      setParseError(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsParsing(false);
      setParsingFileName(null);
      // Clear the input
      event.target.value = '';
    }
  };

  // Keep existing pasted text functionality unchanged
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
            <span className="ml-2">Uploading {parsingFileName}...</span>
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
            <label htmlFor="pasted-title" className="block text-sm font-medium text-stone-700 mb-1">Title/Description</label>
            <input
              id="pasted-title"
              type="text"
              value={pastedTitle}
              onChange={(e) => setPastedTitle(e.target.value)}
              placeholder="e.g., AUSTRAC Update 2024-01"
              className="w-full px-3 py-2 border border-orange-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
              disabled={isParsing}
            />
          </div>
          <div>
            <label htmlFor="pasted-content" className="block text-sm font-medium text-stone-700 mb-1">Content</label>
            <textarea
              id="pasted-content"
              value={pastedContent}
              onChange={(e) => setPastedContent(e.target.value)}
              placeholder="Paste regulatory text, guidelines, or updates here..."
              rows={6}
              className="w-full px-3 py-2 border border-orange-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
              disabled={isParsing}
            />
          </div>
          <button
            onClick={handleAddPastedText}
            disabled={isParsing || !pastedTitle.trim() || !pastedContent.trim()}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors"
          >
            {ICONS.plus("w-4 h-4 mr-2")}
            Add Pasted Content
          </button>
        </div>
        {pastedError && (
          <div className="mt-4 bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg" role="alert">
            <strong className="font-semibold">Error:</strong> {pastedError}
          </div>
        )}
      </div>

      {/* Ingestion Section - Show same as company docs */}
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