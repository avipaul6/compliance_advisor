import React, { useState, useEffect } from 'react';
import { type Change } from 'diff'; 
import { SuggestedChange, UserFeedback } from '../types';
import { ICONS } from '../constants';
import LoadingSpinner from './LoadingSpinner';
import ErrorDisplay from './ErrorDisplay';

interface DraftTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  draftText: string | null; 
  draftComparisonResult: Change[] | null; 
  originalTextForEditing: string | null; 
  error: string | null;
  changeItem: SuggestedChange | null;
  originalDocumentName: string | null;
  onSaveFinalDraftFeedback: (itemId: string, feedbackUpdate: Partial<UserFeedback>) => void;
}

const DraftTextModal: React.FC<DraftTextModalProps> = ({
  isOpen,
  onClose,
  isLoading,
  draftText, 
  draftComparisonResult, 
  originalTextForEditing,
  error,
  changeItem,
  originalDocumentName,
  onSaveFinalDraftFeedback,
}) => {
  const [editableDraft, setEditableDraft] = useState<string>('');
  const [saveAcknowledgmentMessage, setSaveAcknowledgmentMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'compare' | 'edit' | 'original'>('compare');

  useEffect(() => {
    if (draftText) {
      setEditableDraft(draftText);
    } else if (originalTextForEditing) {
      setEditableDraft(originalTextForEditing);
    } else {
      setEditableDraft('');
    }
    setSaveAcknowledgmentMessage(null);
    // Default to compare view whenever new data comes in
    setViewMode('compare');
  }, [draftText, originalTextForEditing, isOpen]);

  useEffect(() => {
    if (saveAcknowledgmentMessage) {
      const timer = setTimeout(() => {
        setSaveAcknowledgmentMessage(null);
      }, 7000); 
      return () => clearTimeout(timer);
    }
  }, [saveAcknowledgmentMessage]);


  if (!isOpen) return null;

  const handleDownload = () => {
    if (!editableDraft || !originalDocumentName) return;
    const blob = new Blob([editableDraft], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const safeFilename = originalDocumentName.replace(/[^a-z0-9_.-]/gi, '_');
    link.download = `${safeFilename}_final_update.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleCopyToClipboard = () => {
    if (!editableDraft) return;
    navigator.clipboard.writeText(editableDraft)
      .then(() => {
        setSaveAcknowledgmentMessage("Final draft text copied to clipboard!");
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
        setSaveAcknowledgmentMessage("Error copying text. See console for details.");
      });
  };

  const handleSaveFinalVersion = () => {
    if (changeItem && editableDraft.trim()) {
      onSaveFinalDraftFeedback(changeItem.id, {
        finalAdoptedText: editableDraft,
        status: changeItem.userFeedback?.status || "Actioned", 
        notes: changeItem.userFeedback?.notes, 
      });
      setSaveAcknowledgmentMessage(`Final version saved as feedback for '${changeItem.document_section}'. This adopted text may guide future AI interactions.`);
    } else {
      setSaveAcknowledgmentMessage("Cannot save empty draft or no change item selected.");
    }
  };
  
  const renderDiffSpans = (diffArray: Change[] | null) => {
    if (!diffArray) return null;
    return diffArray.map((part, index) => {
        let style = 'px-0.5'; 
        if (part.added) {
        style = 'bg-green-100 text-green-700 rounded px-0.5';
        } else if (part.removed) {
        style = 'bg-red-100 text-red-700 line-through rounded px-0.5';
        }
        return (
        <span key={index} className={style}>
            {part.value}
        </span>
        );
    });
  };

  const getButtonClass = (mode: 'compare' | 'edit' | 'original') => {
    const base = "px-3 py-1.5 text-sm font-medium rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-white focus:ring-orange-500";
    if (viewMode === mode) {
      return `${base} bg-orange-100 border-orange-300 text-orange-700 shadow-sm`;
    }
    return `${base} bg-white border-stone-200 text-stone-600 hover:bg-orange-50 hover:border-orange-200`;
  };

  return (
    <div 
      className="fixed inset-0 bg-stone-700/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] transition-opacity duration-300"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-modal-title"
    >
      <div 
        className="bg-white shadow-2xl rounded-lg w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden border border-orange-300"
        onClick={(e) => e.stopPropagation()} 
      >
        <div className="p-6 border-b border-orange-200">
          <h3 id="draft-modal-title" className="text-xl font-semibold text-orange-600">
            Review & Finalize Draft: {originalDocumentName || changeItem?.document_section || 'Selected Item'}
          </h3>
          {changeItem && (
            <p className="text-xs text-stone-500 mt-1">Suggestion: {changeItem.suggested_modification}</p>
          )}
        </div>

        <div className="p-6 flex-grow flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-orange-300 scrollbar-track-orange-100 scrollbar-thumb-rounded-full">
          {/* View Mode Toggles */}
          <div className="flex items-center gap-2 mb-4 p-1.5 bg-stone-100 rounded-lg border border-stone-200 w-fit">
              <button onClick={() => setViewMode('compare')} className={getButtonClass('compare')} disabled={!draftComparisonResult}>
                  Compare Changes
              </button>
              <button onClick={() => setViewMode('edit')} className={getButtonClass('edit')}>
                  Edit Final Version
              </button>
              <button onClick={() => setViewMode('original')} className={getButtonClass('original')} disabled={!originalTextForEditing}>
                  View Original
              </button>
          </div>

          {/* Content Area */}
          <div className="flex-grow flex flex-col min-h-[50vh]">
            {isLoading && (
              <div className="flex flex-col items-center justify-center h-full flex-grow bg-orange-50/50 border border-orange-200 rounded-md">
                <LoadingSpinner size="md" color="text-orange-500"/>
                <p className="mt-2 text-stone-600">Generating AI Draft...</p>
              </div>
            )}

            {!isLoading && viewMode === 'compare' && (
              <>
                <p className="text-xs text-stone-500 mb-2">
                  <span className="px-1 py-0.5 rounded bg-green-100 text-green-700 mr-1">Added text (AI Suggestion)</span>
                  <span className="px-1 py-0.5 rounded bg-red-100 text-red-700 line-through mr-1">Removed text (from Original)</span>
                  <span>Unchanged text</span>
                </p>
                {draftComparisonResult ? (
                  <div className="w-full flex-grow p-3 bg-orange-50 border border-orange-200 rounded-md text-stone-700 text-sm font-mono whitespace-pre-wrap overflow-auto scrollbar-thin scrollbar-thumb-orange-300 scrollbar-track-orange-100 scrollbar-thumb-rounded" aria-label="AI generated draft text with changes highlighted">
                    {renderDiffSpans(draftComparisonResult)}
                  </div>
                ) : (
                  <div className="text-center text-stone-500 py-8 border border-dashed border-orange-200 rounded-md flex-grow flex items-center justify-center bg-orange-50/50">
                    <p>No comparison available. AI draft might be entirely new, original was empty, or AI suggested no change.</p>
                  </div>
                )}
              </>
            )}

            {!isLoading && viewMode === 'edit' && (
              <>
                <p className="text-xs text-stone-500 mb-2">
                  This editable field is pre-filled with the AI's complete suggested draft. Refine it here to create your final version.
                </p>
                <textarea
                  value={editableDraft}
                  onChange={(e) => setEditableDraft(e.target.value)}
                  className="w-full flex-grow p-3 bg-white border border-orange-300 rounded-md text-stone-800 text-sm font-mono whitespace-pre leading-relaxed focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 scrollbar-thin scrollbar-thumb-orange-300 scrollbar-track-orange-100 scrollbar-thumb-rounded shadow-sm"
                  aria-label="Editable final draft text"
                  placeholder="Final draft text will appear here. You can edit it directly."
                />
              </>
            )}
            
            {!isLoading && viewMode === 'original' && (
              <>
                 <p className="text-xs text-stone-500 mb-2">
                  A clean, read-only view of the original document before any changes.
                </p>
                {originalTextForEditing ? (
                  <div className="w-full flex-grow p-3 bg-orange-50 border border-orange-200 rounded-md text-stone-700 text-sm overflow-auto scrollbar-thin scrollbar-thumb-orange-300 scrollbar-track-orange-100 scrollbar-thumb-rounded" aria-label="Original document text">
                    <div className="whitespace-pre-wrap font-sans">
                        {originalTextForEditing}
                    </div>
                  </div>
                ) : (
                    <div className="text-center text-stone-500 py-8 border border-dashed border-orange-200 rounded-md flex-grow flex items-center justify-center bg-orange-50/50">
                        <p>Original document content is not available.</p>
                    </div>
                )}
              </>
            )}
          </div>
        </div>
        
        {saveAcknowledgmentMessage && (
            <div className="px-6 pb-2">
                <div className={`p-2 text-xs rounded-md border text-center transition-opacity duration-300 ease-in-out ${saveAcknowledgmentMessage.includes("Error") ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                    {saveAcknowledgmentMessage}
                </div>
            </div>
        )}
        {error && !isLoading && !saveAcknowledgmentMessage && <div className="px-6 pb-2"><ErrorDisplay message={error} /></div>}

        <div className="p-4 bg-orange-50 border-t border-orange-200 flex flex-wrap justify-end items-center gap-3">
          {!isLoading && !error && (
            <>
              <button
                onClick={handleSaveFinalVersion}
                disabled={!editableDraft.trim() || !changeItem}
                className="px-4 py-2 text-sm font-medium rounded-md text-white bg-green-500 hover:bg-green-600 disabled:bg-stone-300 disabled:text-stone-500 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-orange-50"
                title={!editableDraft.trim() || !changeItem ? "Enter text and ensure an item is selected to save" : "Save this version as feedback"}
              >
                {ICONS.checkCircle("w-4 h-4 mr-1.5 inline-block")} Save Final Version as Feedback
              </button>
              <button
                onClick={handleCopyToClipboard}
                disabled={!editableDraft.trim()}
                className="px-4 py-2 text-sm font-medium rounded-md text-orange-700 bg-orange-100 hover:bg-orange-200 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-orange-50"
              >
                {ICONS.clipboardList("w-4 h-4 mr-1.5 inline-block")} Copy Your Version
              </button>
              <button
                onClick={handleDownload}
                disabled={!editableDraft.trim()}
                className="px-4 py-2 text-sm font-medium rounded-md text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-orange-50"
              >
                {ICONS.arrowUpTray("w-4 h-4 mr-1.5 inline-block")} Download Your Version (.txt)
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md text-stone-700 bg-stone-200 hover:bg-stone-300 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 focus:ring-offset-orange-50"
            aria-label="Close draft text modal"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DraftTextModal;