// frontend/src/components/DocumentIndexDashboard.tsx
import React, { useState, useEffect } from 'react';
import { uploadService } from '../services/uploadService';
import { ICONS } from '../constants';
import LoadingSpinner from './LoadingSpinner';

interface IndexedDocument {
  id: string;
  name: string;
  content_uri?: string;
  metadata: {
    title?: string;
    document_type?: string;
    upload_timestamp?: string;
    file_size?: number;
    processing_timestamp?: string;
    file_path?: string;
    bucket?: string;
  };
  status: 'indexed' | 'processing' | 'failed';
}

interface DocumentIndexDashboardProps {
  className?: string;
}

const DocumentIndexDashboard: React.FC<DocumentIndexDashboardProps> = ({ className = '' }) => {
  const [indexedDocuments, setIndexedDocuments] = useState<IndexedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadIndexedDocuments = async () => {
    try {
      const response = await uploadService.listIndexedDocuments();
      
      // Transform the response to include status
      const documentsWithStatus: IndexedDocument[] = response.documents.map(doc => ({
        ...doc,
        status: 'indexed' as const // All returned documents are considered indexed
      }));
      
      setIndexedDocuments(documentsWithStatus);
      setError(null);
    } catch (err) {
      console.error('Failed to load indexed documents:', err);
      setError(`Failed to load indexed documents: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const refreshDocuments = async () => {
    setRefreshing(true);
    await loadIndexedDocuments();
    setRefreshing(false);
  };

  useEffect(() => {
    const initLoad = async () => {
      setLoading(true);
      await loadIndexedDocuments();
      setLoading(false);
    };
    initLoad();
  }, []);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';
    try {
      return new Date(dateString).toLocaleDateString('en-AU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const getDocumentTypeColor = (type?: string) => {
    switch (type) {
      case 'company': return 'bg-blue-100 text-blue-800';
      case 'regulatory': return 'bg-green-100 text-green-800';
      case 'austrac': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStorageUrl = (doc: IndexedDocument) => {
    if (doc.content_uri) return doc.content_uri;
    if (doc.metadata.file_path && doc.metadata.bucket) {
      return `https://console.cloud.google.com/storage/browser/${doc.metadata.bucket}/${doc.metadata.file_path}`;
    }
    return null;
  };

  if (loading) {
    return (
      <div className={`p-6 bg-white rounded-lg shadow-md ${className}`}>
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="lg" />
          <span className="ml-3 text-lg text-gray-600">Loading indexed documents...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 bg-white rounded-lg shadow-lg border border-orange-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-orange-600 flex items-center">
            {ICONS.clipboardList("w-6 h-6 mr-2")}
            RAG Index Status
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Documents currently indexed in your Vector Search RAG system
          </p>
        </div>
        
        <button
          onClick={refreshDocuments}
          disabled={refreshing}
          className="flex items-center px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {refreshing ? (
            <LoadingSpinner size="sm" color="text-white" />
          ) : (
            ICONS.arrowUpTray("w-4 h-4")
          )}
          <span className="ml-2">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="text-2xl font-bold text-blue-600">{indexedDocuments.length}</div>
          <div className="text-sm text-blue-700">Total Indexed Documents</div>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="text-2xl font-bold text-green-600">
            {indexedDocuments.filter(doc => doc.metadata.document_type === 'company').length}
          </div>
          <div className="text-sm text-green-700">Company Documents</div>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <div className="text-2xl font-bold text-purple-600">
            {indexedDocuments.filter(doc => doc.metadata.document_type === 'regulatory' || doc.metadata.document_type === 'austrac').length}
          </div>
          <div className="text-sm text-purple-700">Regulatory Documents</div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center text-red-700">
            {ICONS.exclamationTriangle("w-5 h-5 mr-2")}
            <span className="font-medium">Error loading documents</span>
          </div>
          <p className="text-sm text-red-600 mt-1">{error}</p>
        </div>
      )}

      {/* Documents List */}
      {indexedDocuments.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="mb-4">
            {ICONS.documentText("w-16 h-16 mx-auto text-gray-300")}
          </div>
          <h3 className="text-lg font-medium mb-2">No Documents Indexed</h3>
          <p className="text-sm">
            No documents are currently indexed in your RAG system. 
            Upload documents using the upload feature to see them here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-gray-900 mb-3">
            Indexed Documents ({indexedDocuments.length})
          </h3>
          
          {indexedDocuments.map((doc) => {
            const storageUrl = getStorageUrl(doc);
            
            return (
              <div key={doc.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      {ICONS.documentText("w-5 h-5 text-gray-500")}
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {doc.metadata.title || doc.name || 'Unnamed Document'}
                      </h4>
                      
                      {doc.metadata.document_type && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDocumentTypeColor(doc.metadata.document_type)}`}>
                          {doc.metadata.document_type}
                        </span>
                      )}
                      
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✓ Indexed
                      </span>
                    </div>
                    
                    <div className="text-xs text-gray-500 space-y-1">
                      <div>Document ID: <code className="bg-gray-100 px-1 rounded">{doc.id}</code></div>
                      
                      {doc.metadata.file_size && (
                        <div>Size: {formatFileSize(doc.metadata.file_size)}</div>
                      )}
                      
                      {doc.metadata.upload_timestamp && (
                        <div>Uploaded: {formatDate(doc.metadata.upload_timestamp)}</div>
                      )}
                      
                      {doc.metadata.processing_timestamp && (
                        <div>Indexed: {formatDate(doc.metadata.processing_timestamp)}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    {storageUrl && (
                      <a
                        href={storageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                      >
                        {ICONS.link("w-3 h-3 mr-1")}
                        View in Storage
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Footer Info */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          <p>
            <strong>Note:</strong> This shows documents currently indexed in your Vector Search RAG system. 
            Documents must be uploaded and processed to appear here and be available for AI analysis.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DocumentIndexDashboard;