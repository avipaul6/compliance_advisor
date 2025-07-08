import React, { useState } from 'react';
import { CompanyDocument } from '../types'; 
import { ICONS } from '../constants';
import LoadingSpinner from './LoadingSpinner';
import { uploadService } from '../services/uploadService'; // Added import for uploadService
import ComplianceDocumentCard from './ComplianceDocumentCard';

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

  // UPDATED: New handleFileChange using uploadService instead of local parsing
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsParsing(true);
    setParseError(null);
    
    try {
      console.log(`Starting upload of ${files.length} files to cloud storage...`);
      
      // Upload files using your existing uploadService
      const results = await uploadService.uploadMultipleDocuments(
        files,
        'company', // document type
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
        // Convert successful uploads to CompanyDocument format for your UI
        const newDocuments = successfulUploads.map((result, index) => ({
          id: result.document_id || `upload-${Date.now()}-${index}`,
          name: result.metadata?.original_filename || `Document ${index + 1}`,
          textContent: '', // Content will be processed by Vertex AI in the cloud
          type: 'generic' as const, // You can enhance this based on file extension
          lastModified: Date.now(),
          size: parseInt(result.metadata?.file_size || '0'),
          isProcessedForRag: false, // Will be processed by cloud function
          // Add cloud storage metadata
          metadata: {
            file_path: result.file_path,
            storage_url: result.storage_url,
            document_id: result.document_id,
            ...result.metadata
          }
        }));

        // Add to existing documents
        setCompanyDocs(prev => [...prev, ...newDocuments]);
        
        console.log(`✅ Successfully uploaded ${successfulUploads.length} documents to cloud storage`);
        
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
            <span className="ml-2">Uploading {parsingFileName}...</span>
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
              <ComplianceDocumentCard
                key={doc.id}
                doc={doc}
                onRemove={handleRemoveDocument}
                disabled={isParsing || isIngestionProcessing}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CompanyDocumentsPage;