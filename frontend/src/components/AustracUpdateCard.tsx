import React from 'react';
import { AustracUpdate } from '../types';
import { ICONS } from '../constants';

interface AustracUpdateCardProps {
  item: AustracUpdate;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

const AustracUpdateCard: React.FC<AustracUpdateCardProps> = ({ item, onRemove, disabled }) => {
  return (
    <div className="bg-orange-50 p-4 rounded-lg flex justify-between items-start shadow-sm transition-all hover:bg-orange-100 border border-orange-200">
      <div className="flex items-start overflow-hidden">
        {ICONS.documentText("w-6 h-6 mr-3 text-orange-500 flex-shrink-0 mt-1")}
        <div className="truncate mr-2">
          <p className="font-medium text-stone-800 truncate" title={item.title}>{item.title}</p>
          <div className="text-xs text-stone-500 mb-1 flex items-center space-x-2 flex-wrap">
            <span>Type: {item.type.toUpperCase()}</span>
            <span>Added: {new Date(item.dateAdded).toLocaleDateString()}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-white text-xs ${item.isProcessedForRag ? 'bg-green-500' : 'bg-amber-500'}`} title={item.isProcessedForRag ? `Ingested to Vertex AI RAG (simulated)` : 'Not yet ingested to Vertex AI RAG (simulated)'}>
              {item.isProcessedForRag ? 'Vertex AI RAG Ready' : 'Needs Ingestion'}
            </span>
          </div>
          <p className="text-xs text-stone-600 break-words">
            <span className="font-semibold">Content Snippet: </span> {item.rawContent.substring(0, 100)}{item.rawContent.length > 100 ? "..." : ""}
          </p>
        </div>
      </div>
      <button
        onClick={() => onRemove(item.id)}
        title={`Remove Regulatory Item: ${item.title}`}
        aria-label={`Remove Regulatory Item: ${item.title}`}
        className="p-2 rounded-md text-stone-500 hover:text-red-500 hover:bg-red-100 transition-colors flex-shrink-0 ml-2"
        disabled={disabled}
      >
        {ICONS.trash("w-5 h-5")}
      </button>
    </div>
  );
};

export default AustracUpdateCard;