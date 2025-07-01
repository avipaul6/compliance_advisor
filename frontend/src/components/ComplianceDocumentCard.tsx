import React from 'react';
import { CompanyDocument } from '../types';
import { ICONS } from '../constants';
import { formatBytes } from '../utils';

interface ComplianceDocumentCardProps {
  doc: CompanyDocument;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

const ComplianceDocumentCard: React.FC<ComplianceDocumentCardProps> = ({ doc, onRemove, disabled }) => {
  return (
    <li className="bg-orange-50 p-4 rounded-lg flex justify-between items-center shadow-sm transition-all hover:bg-orange-100 border border-orange-200">
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
        onClick={() => onRemove(doc.id)}
        title="Remove document"
        className="p-2 rounded-md text-stone-500 hover:text-red-500 hover:bg-red-100 transition-colors flex-shrink-0 ml-2"
        disabled={disabled}
        aria-label={`Remove document ${doc.name}`}
      >
        {ICONS.trash("w-5 h-5")}
      </button>
    </li>
  );
};

export default ComplianceDocumentCard;