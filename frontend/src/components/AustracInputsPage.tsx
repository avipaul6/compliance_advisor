// frontend/src/components/AustracInputsPage.tsx
import React, { useState, useCallback } from 'react';
import { AustracUpdate } from '../types';
import { ICONS } from '../constants';
import LoadingSpinner from './LoadingSpinner';
import { generateUniqueId } from '../utils';

// Import uploadService with error boundary - FIXED for production
import { uploadService } from '../services/uploadService';

// Remove the dynamic require attempt since it fails in production
console.log('🔄 uploadService imported:', uploadService ? 'SUCCESS' : 'FAILED');

// Import AustracUpdateCard with error boundary
let AustracUpdateCard: any;
try {
  AustracUpdateCard = require('./AustracUpdateCard').default;
} catch (error) {
  console.warn('AustracUpdateCard not available, using fallback');
  AustracUpdateCard = ({ item, onRemove, disabled }: any) => (
    <div className="bg-orange-50 p-4 rounded-lg flex justify-between items-start shadow-sm border border-orange-200">
      <div className="flex-1">
        <p className="font-medium text-stone-800">{item.title}</p>
        <p className="text-xs text-stone-500">Type: {item.type} | Added: {new Date(item.dateAdded).toLocaleDateString()}</p>
        <p className="text-xs text-stone-600 mt-1">{item.rawContent.substring(0, 100)}...</p>
      </div>
      <button
        onClick={() => onRemove(item.id)}
        disabled={disabled}
        className="ml-2 p-2 text-red-500 hover:bg-red-100 rounded"
      >
        Remove
      </button>
    </div>
  );
}

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

  // Safe file upload handler with comprehensive error handling
  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🔄 handleFileChange triggered');
    
    const files = event.target.files;
    if (!files || files.length === 0) {
      console.log('No files selected');
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setParsingFileName(`Processing ${files.length} file(s)...`);
    
    try {
      console.log(`Starting upload of ${files.length} regulatory files...`);
      
      // Check if uploadService is available
      if (!uploadService || !uploadService.uploadMultipleDocuments) {
        throw new Error('Upload service not available. Please refresh the page and try again.');
      }

      // Convert FileList to Array safely
      const fileArray = Array.from(files);
      console.log('Files to upload:', fileArray.map(f => f.name));
      
      // Validate files before upload
      for (const file of fileArray) {
        if (file.size === 0) {
          throw new Error(`File "${file.name}" is empty`);
        }
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
          throw new Error(`File "${file.name}" is too large (max 10MB)`);
        }
      }

      setParsingFileName('Uploading to cloud storage...');
      
      // Upload files with comprehensive error handling
      const batchResult = await uploadService.uploadMultipleDocuments(fileArray, 'regulatory');
      console.log('Upload batch result:', batchResult);
      
      // Safely process results
      if (!batchResult || !batchResult.uploads) {
        throw new Error('Invalid response from upload service');
      }

      const results = batchResult.uploads.map((upload: any) => upload.result).filter(Boolean);
      const successfulUploads = results.filter((result: any) => result && result.success);
      const failedUploads = results.filter((result: any) => result && !result.success);

      console.log(`Upload results: ${successfulUploads.length} successful, ${failedUploads.length} failed`);

      // Handle failed uploads
      if (failedUploads.length > 0) {
        const errorMessages = failedUploads.map((result: any) => 
          result.message || 'Unknown upload error'
        ).join('\n');
        setParseError(`Some uploads failed:\n${errorMessages}`);
      }

      // Handle successful uploads
      if (successfulUploads.length > 0) {
        setParsingFileName('Processing successful uploads...');
        
        const newUpdates: AustracUpdate[] = successfulUploads.map((result: any, index: number) => ({
          id: result.document_id || `regulatory-upload-${Date.now()}-${index}`,
          title: result.metadata?.original_filename || `Regulatory Document ${index + 1}`,
          rawContent: '', // Content processed by Vertex AI in cloud
          type: 'pdf' as const,
          dateAdded: new Date().toISOString(),
          isProcessedForRag: false,
          metadata: {
            file_path: result.file_path,
            storage_url: result.storage_url,
            document_id: result.document_id,
            ...result.metadata
          }
        }));

        // Update state safely
        setUserAustracContent(prev => [...prev, ...newUpdates]);
        
        console.log(`✅ Successfully processed ${successfulUploads.length} regulatory documents`);
        
        // Clear errors if all uploads succeeded
        if (failedUploads.length === 0) {
          setParseError(null);
        }
      }

      // Log summary
      if (batchResult.summary) {
        console.log(`Upload summary: ${batchResult.summary.successful_uploads}/${batchResult.summary.total_files} successful`);
      }

    } catch (error) {
      console.error('❌ Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
      setParseError(`Upload failed: ${errorMessage}`);
    } finally {
      setIsParsing(false);
      setParsingFileName(null);
      
      // Clear the input safely
      try {
        if (event.target) {
          event.target.value = '';
        }
      } catch (e) {
        console.warn('Could not clear file input:', e);
      }
    }
  }, [setUserAustracContent]);

  // Safe pasted text handler
  const handleAddPastedText = useCallback(() => {
    console.log('🔄 handleAddPastedText triggered');
    
    setPastedError(null);
    
    if (!pastedTitle.trim()) { 
      setPastedError("Title for pasted text cannot be empty."); 
      return; 
    }
    
    if (!pastedContent.trim()) { 
      setPastedError("Content for pasted text cannot be empty."); 
      return; 
    }

    try {
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
      
      console.log('✅ Added pasted content:', newUpdate.title);
    } catch (error) {
      console.error('❌ Error adding pasted content:', error);
      setPastedError('Failed to add pasted content. Please try again.');
    }
  }, [pastedTitle, pastedContent, setUserAustracContent]);

  // Safe remove handler
  const handleRemoveAustracItem = useCallback((itemId: string) => {
    console.log('🔄 Removing item:', itemId);
    
    try {
      setUserAustracContent(prevUpdates => 
        prevUpdates.filter(upd => upd.id !== itemId)
      );
      console.log('✅ Removed item:', itemId);
    } catch (error) {
      console.error('❌ Error removing item:', error);
    }
  }, [setUserAustracContent]);

  // Safe calculations
  const uningestedCount = Math.max(0, totalDocs - ingestedDocsCount);

  // Safe render with error boundaries
  try {
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
          {isParsing && (
            <div className="mt-4 flex items-center text-orange-600">
              <LoadingSpinner size="sm" color="text-orange-500"/>
              <span className="ml-2">
                {parsingFileName || "Processing upload..."}
              </span>
            </div>
          )}
          {parseError && (
            <div className="mt-4 bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg" role="alert">
              <strong className="font-semibold">Error during file upload:</strong>
              <pre className="whitespace-pre-wrap text-sm">{parseError}</pre>
            </div>
          )}
          {!uploadService && (
            <div className="mt-4 bg-yellow-50 border border-yellow-300 text-yellow-700 px-4 py-3 rounded-lg" role="alert">
              <strong className="font-semibold">Info:</strong> Upload service initializing. If this persists, please refresh the page.
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
              {/* Using existing arrowUpTray icon instead of missing plus icon */}
              {ICONS.arrowUpTray("w-4 h-4 mr-2")}
              Add Pasted Content
            </button>
          </div>
          {pastedError && (
            <div className="mt-4 bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg" role="alert">
              <strong className="font-semibold">Error:</strong> {pastedError}
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
              onClick={() => {
                try {
                  onIngestAll(allDocsIngested);
                } catch (error) {
                  console.error('Error triggering ingestion:', error);
                }
              }}
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
              {userAustracContent.map(item => {
                try {
                  return (
                    <AustracUpdateCard 
                      key={item.id}
                      item={item}
                      onRemove={handleRemoveAustracItem}
                      disabled={isParsing}
                    />
                  );
                } catch (error) {
                  console.error('Error rendering AustracUpdateCard:', error);
                  return (
                    <div key={item.id} className="bg-red-50 border border-red-200 p-3 rounded">
                      <p className="text-red-700">Error displaying: {item.title}</p>
                      <button 
                        onClick={() => handleRemoveAustracItem(item.id)}
                        className="text-red-500 text-sm underline"
                      >
                        Remove
                      </button>
                    </div>
                  );
                }
              })}
            </ul>
          )}
        </div>
      </div>
    );
  } catch (error) {
    console.error('❌ Fatal error in AustracInputsPage render:', error);
    
    // Fallback error UI
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6 bg-white shadow-xl rounded-lg border border-red-200">
        <h2 className="text-2xl font-semibold mb-4 text-red-600">
          Error Loading Regulatory Input Page
        </h2>
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-semibold">Something went wrong loading this page.</p>
          <p className="text-sm mt-2">
            Please check the browser console for more details and refresh the page.
          </p>
          <p className="text-xs mt-2 font-mono">
            Error: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Reload Page
        </button>
      </div>
    );
  }
};

export default AustracInputsPage;