import React, { useState, useEffect } from 'react';
import { SuggestedChange, UserFeedback } from '../types';
import { ICONS } from '../constants';

interface SuggestedChangeCardProps {
  change: SuggestedChange;
  renderPriorityBadge: (priority: 'High' | 'Medium' | 'Low') => React.ReactNode;
  onGenerateDraft: (change: SuggestedChange) => void;
  onDiscussInChat: (change: SuggestedChange) => void; 
  isDraftingEnabled: boolean;
  onUpdateFeedback: (itemId: string, feedbackUpdate: Partial<UserFeedback>) => void;
}

const SuggestedChangeCard: React.FC<SuggestedChangeCardProps> = ({ 
    change, 
    renderPriorityBadge, 
    onGenerateDraft, 
    onDiscussInChat, 
    isDraftingEnabled,
    onUpdateFeedback,
}) => {
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [currentNotes, setCurrentNotes] = useState(change.userFeedback?.notes || '');
  const [selectedStatus, setSelectedStatus] = useState(change.userFeedback?.status || "select");
  
  // Sync local state with props when change.userFeedback updates from App.tsx
  useEffect(() => {
    setSelectedStatus(change.userFeedback?.status || "select");
    setCurrentNotes(change.userFeedback?.notes || '');
    // Don't automatically show notes input unless user clicks
    setShowNotesInput(false);
  }, [change.userFeedback]);


  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    setSelectedStatus(newStatus);
    onUpdateFeedback(change.id, { status: newStatus === "select" ? undefined : newStatus });
  };
  
  const handleSaveNotes = () => {
    onUpdateFeedback(change.id, { notes: currentNotes.trim() });
    setShowNotesInput(false);
  };
  
  const handleCancelNotes = () => {
    setCurrentNotes(change.userFeedback?.notes || '');
    setShowNotesInput(false);
  };

  const statusOptions = ["select", "Pending Review", "Actioned", "Not Applicable", "Considered - No Action"]; 

  return (
    <div className="bg-white shadow-md rounded-lg p-6 border border-orange-200 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <h4 className="text-lg font-semibold text-amber-600 flex items-center">
          {ICONS.lightBulb("w-5 h-5 mr-2 text-amber-500")}
          {change.document_section}
        </h4>
        {renderPriorityBadge(change.priority)}
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-stone-500">Current Status:</p>
          <p className="text-sm text-stone-700">{change.current_status_summary}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-stone-500">AUSTRAC Relevance:</p>
          <p className="text-sm text-stone-700">{change.austrac_relevance}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-stone-500">Suggested Modification:</p>
          <p className="text-sm text-stone-700">{change.suggested_modification}</p>
        </div>
      </div>
      
      {/* Feedback Section */}
      <div className="mt-4 pt-4 border-t border-orange-200">
        <h5 className="text-sm font-semibold text-stone-600 mb-2">Track Progress & Provide Feedback:</h5>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <label htmlFor={`status-${change.id}`} className="block text-xs font-medium text-stone-500 mb-1">Status</label>
            <select
              id={`status-${change.id}`}
              value={selectedStatus}
              onChange={handleStatusChange}
              className="w-full p-2 bg-white border border-orange-300 rounded-md shadow-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-stone-700 text-sm"
            >
              {statusOptions.map(opt => (
                <option key={opt} value={opt} disabled={opt === "select"}>{opt === "select" ? "Select Status" : opt}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            {!showNotesInput && (
              <button
                onClick={() => {
                  setCurrentNotes(change.userFeedback?.notes || '');
                  setShowNotesInput(true);
                }}
                className="inline-flex items-center justify-center px-3 py-2 border border-orange-300 text-sm font-medium rounded-md text-orange-700 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-orange-500 transition-colors shadow-sm"
              >
                {change.userFeedback?.notes ? "Edit Note" : "Add Note"}
                 {change.userFeedback?.notes && ICONS.documentText("w-4 h-4 ml-2 opacity-60")}
              </button>
            )}
            {change.userFeedback?.status && !showNotesInput && change.userFeedback.notes && (
              <p className="text-xs text-stone-500 mt-1 truncate" title={change.userFeedback.notes}>Note: {change.userFeedback.notes}</p>
            )}
          </div>
        </div>

        {showNotesInput && (
          <div className="mt-3">
            <label htmlFor={`notes-${change.id}`} className="block text-xs font-medium text-stone-500 mb-1">
              Note (Optional)
            </label>
            <textarea
              id={`notes-${change.id}`}
              value={currentNotes}
              onChange={(e) => setCurrentNotes(e.target.value)}
              rows={3}
              className='w-full p-2 bg-white border rounded-md shadow-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-stone-700 text-sm border-orange-300'
              placeholder="Provide a reason or comment..."
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleSaveNotes}
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-md shadow-sm transition-colors"
              >
                Save Note
              </button>
              <button
                onClick={handleCancelNotes}
                className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-medium rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>


      {change.suggested_modification && 
       change.suggested_modification.toLowerCase() !== 'n/a' && 
       change.suggested_modification.toLowerCase() !== 'no specific modification needed.' && (
        <div className="mt-4 pt-3 border-t border-orange-200 flex flex-wrap gap-3">
          <button
            onClick={() => onGenerateDraft(change)}
            disabled={!isDraftingEnabled}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-orange-500 hover:bg-orange-600 disabled:bg-stone-300 disabled:text-stone-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-orange-500 transition-colors"
            title={!isDraftingEnabled ? "Drafting feature requires AI client." : "Generate a draft of the updated document text based on this suggestion."}
          >
            {ICONS.documentText("w-4 h-4 mr-2")}
            Draft Updated Text
          </button>
          <button
            onClick={() => onDiscussInChat(change)}
            disabled={!isDraftingEnabled} 
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-500 hover:bg-amber-600 disabled:bg-stone-300 disabled:text-stone-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-amber-500 transition-colors"
            title={!isDraftingEnabled ? "Chat feature requires AI client." : "Discuss this specific change with the AI Chatbot."}
          >
            {ICONS.chatBubbleLeftRight("w-4 h-4 mr-2")}
            Discuss in Chat
          </button>
        </div>
      )}
    </div>
  );
};

export default SuggestedChangeCard;