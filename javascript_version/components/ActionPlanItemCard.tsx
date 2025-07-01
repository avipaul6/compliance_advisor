

import React, { useState } from 'react';
import { ActionPlanItem, UserFeedback } from '../types';
import { ICONS } from '../constants.tsx';

interface ActionPlanItemCardProps {
  item: ActionPlanItem;
  renderPriorityBadge: (priority: 'High' | 'Medium' | 'Low') => React.ReactNode;
  onUpdateFeedback: (itemId: string, feedbackUpdate: Partial<UserFeedback>) => void;
}

const ActionPlanItemCard: React.FC<ActionPlanItemCardProps> = ({ item, renderPriorityBadge, onUpdateFeedback }) => {
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [currentNotes, setCurrentNotes] = useState(item.userFeedback?.notes || '');

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    onUpdateFeedback(item.id, { status: newStatus === "select" ? undefined : newStatus });
  };

  const handleSaveNotes = () => {
    onUpdateFeedback(item.id, { notes: currentNotes });
    setShowNotesInput(false);
  };
  
  const statusOptions = ["select", "Pending Review", "Actioned", "Not Applicable", "Considered - No Action"];

  return (
    <div className="bg-white shadow-md rounded-lg p-6 border border-orange-200 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <h4 className="text-lg font-semibold text-green-600 flex items-center">
            {ICONS.clipboardList("w-5 h-5 mr-2 text-green-500")}
            Task: {item.task}
        </h4>
        {renderPriorityBadge(item.priority_level)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
        <div>
          <span className="font-medium text-stone-500">Responsible: </span>
          <span className="text-stone-700">{item.responsible}</span>
        </div>
        <div>
          <span className="font-medium text-stone-500">Timeline: </span>
          <span className="text-stone-700">{item.timeline}</span>
        </div>
      </div>

      {/* Feedback Section */}
      <div className="mt-2 pt-4 border-t border-orange-200">
        <h5 className="text-sm font-semibold text-stone-600 mb-2">Track Task:</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <label htmlFor={`status-ap-${item.id}`} className="block text-xs font-medium text-stone-500 mb-1">Status</label>
            <select
              id={`status-ap-${item.id}`}
              value={item.userFeedback?.status || "select"}
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
                  setCurrentNotes(item.userFeedback?.notes || '');
                  setShowNotesInput(true);
                }}
                className="inline-flex items-center justify-center px-3 py-2 border border-orange-300 text-sm font-medium rounded-md text-orange-700 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-orange-500 transition-colors shadow-sm"
              >
                {item.userFeedback?.notes ? "Edit Note" : "Add Note"}
                 {item.userFeedback?.notes && ICONS.documentText("w-4 h-4 ml-2 opacity-60")}
              </button>
            )}
             {item.userFeedback?.status && !showNotesInput && item.userFeedback.notes && (
                 <p className="text-xs text-stone-500 mt-1 truncate" title={item.userFeedback.notes}>Note: {item.userFeedback.notes}</p>
            )}
          </div>
        </div>
        {showNotesInput && (
          <div className="mt-3">
            <label htmlFor={`notes-ap-${item.id}`} className="block text-xs font-medium text-stone-500 mb-1">Notes</label>
            <textarea
              id={`notes-ap-${item.id}`}
              value={currentNotes}
              onChange={(e) => setCurrentNotes(e.target.value)}
              rows={3}
              className="w-full p-2 bg-white border border-orange-300 rounded-md shadow-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500 text-stone-700 text-sm"
              placeholder="Add internal notes about this action item..."
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleSaveNotes}
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-md shadow-sm transition-colors"
              >
                Save Note
              </button>
              <button
                onClick={() => setShowNotesInput(false)}
                className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-medium rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActionPlanItemCard;