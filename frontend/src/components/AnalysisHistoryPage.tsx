import React, { useState } from 'react';
import { SavedAnalysis } from '../types';
import { ICONS } from '../constants';

interface AnalysisHistoryPageProps {
  savedAnalyses: SavedAnalysis[];
  onSelectAnalysis: (id: string) => void;
  onDeleteAnalysis: (id: string) => void;
  onRenameAnalysis: (id: string, newName: string) => void;
}

const AnalysisHistoryPage: React.FC<AnalysisHistoryPageProps> = ({
  savedAnalyses,
  onSelectAnalysis,
  onDeleteAnalysis,
  onRenameAnalysis,
}) => {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newName, setNewName] = useState<string>('');

  const handleStartRename = (analysis: SavedAnalysis) => {
    setRenamingId(analysis.id);
    setNewName(analysis.name);
  };

  const handleConfirmRename = () => {
    if (renamingId && newName.trim()) {
      onRenameAnalysis(renamingId, newName.trim());
    }
    setRenamingId(null);
    setNewName('');
  };

  const sortedAnalyses = [...savedAnalyses].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 bg-white shadow-xl rounded-lg border border-orange-200">
      <h2 className="text-3xl font-semibold mb-8 text-orange-600 flex items-center justify-center">
        {ICONS.archiveBox("w-8 h-8 mr-3 text-orange-500")}
        Analysis History
      </h2>

      {sortedAnalyses.length === 0 ? (
        <div className="text-center py-12 text-stone-500 border-2 border-dashed border-orange-200 rounded-lg bg-orange-50/50">
          {ICONS.archiveBoxXMark("w-16 h-16 mx-auto mb-4 opacity-40 text-orange-400")}
          <p className="text-xl font-medium">No analyses saved yet.</p>
          <p className="mt-2 text-sm">
            Run a new analysis from the "Regulatory Target: Gap Review" or "Document Deep Dive" tab. It will be automatically saved here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedAnalyses.map((analysis) => (
            <div key={analysis.id} className="bg-orange-50 p-5 rounded-lg shadow-md border border-orange-200 hover:shadow-lg transition-shadow">
              <div className="flex flex-col sm:flex-row justify-between items-start mb-3">
                {renamingId === analysis.id ? (
                  <div className="flex-grow mb-2 sm:mb-0 flex items-center w-full">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onBlur={handleConfirmRename}
                      onKeyPress={(e) => e.key === 'Enter' && handleConfirmRename()}
                      className="flex-grow bg-white text-orange-700 text-lg font-semibold p-1.5 rounded-md border border-orange-400 focus:ring-1 focus:ring-orange-500 shadow-sm"
                      autoFocus
                    />
                     <button onClick={handleConfirmRename} className="ml-2 text-xs bg-orange-500 px-3 py-1.5 rounded text-white hover:bg-orange-600 transition-colors">Save</button>
                     <button onClick={() => setRenamingId(null)} className="ml-1 text-xs bg-stone-200 px-3 py-1.5 rounded text-stone-700 hover:bg-stone-300 transition-colors">Cancel</button>
                  </div>
                ) : (
                  <h3 
                    className="text-xl font-semibold text-orange-600 hover:text-orange-700 cursor-pointer mb-1 sm:mb-0 truncate"
                    onClick={() => handleStartRename(analysis)}
                    title={`Click to rename: ${analysis.name}`}
                  >
                    {analysis.name}
                  </h3>
                )}
                <span className="text-xs text-stone-500 mt-1 sm:mt-0 whitespace-nowrap">
                  Saved: {new Date(analysis.timestamp).toLocaleString()}
                </span>
              </div>
              
              <div className="mb-2">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full text-white ${analysis.type === 'challenge' ? 'bg-sky-500' : 'bg-teal-500'}`}>
                    {analysis.type === 'challenge' ? 'Regulatory Target: Gap Review' : 'Document Deep Dive'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                {analysis.type === 'challenge' && analysis.challengeAnalysisResult && ( 
                    <>
                        <div>
                            <p className="font-medium text-stone-600">Suggestions:</p>
                            <p className="text-stone-700">{analysis.challengeAnalysisResult.suggested_changes.length}</p>
                        </div>
                        <div>
                            <p className="font-medium text-stone-600">Action Items:</p>
                            <p className="text-stone-700">{analysis.challengeAnalysisResult.action_plan.length}</p>
                        </div>
                        <div>
                            <p className="font-medium text-stone-600">Inputs Used:</p>
                            <p className="text-stone-500 text-xs truncate" title={`${analysis.companyDocumentsUsedSnapshot?.length || 0} Co. Docs, ${analysis.austracInputsUsedSnapshot?.length || 0} Regulatory Items`}>
                                {analysis.companyDocumentsUsedSnapshot?.length || 0} Co. Docs, {analysis.austracInputsUsedSnapshot?.length || 0} Regulatory
                            </p>
                        </div>
                    </>
                )}
                 {analysis.type === 'deepDive' && analysis.deepDiveAnalysisResult && (
                    <>
                        <div className="md:col-span-2">
                            <p className="font-medium text-stone-600">Document Analyzed:</p>
                            <p className="text-stone-700 truncate" title={analysis.selectedDocumentSnapshot?.name}>
                                {analysis.selectedDocumentSnapshot?.name || 'N/A'}
                            </p>
                        </div>
                        <div>
                            <p className="font-medium text-stone-600">Analysis Items:</p>
                            <p className="text-stone-700">
                                {(analysis.deepDiveAnalysisResult.suggested_changes?.length || 0) + (analysis.deepDiveAnalysisResult.action_plan?.length || 0)}
                            </p>
                        </div>
                    </>
                )}
              </div>
              
              <div className="text-xs text-stone-500 max-h-24 overflow-y-auto mb-3 border-t border-b border-orange-100 py-2 scrollbar-thin scrollbar-thumb-orange-300 scrollbar-track-orange-100/50">
                {analysis.type === 'challenge' && ( 
                    <>
                        <strong className="text-stone-600">Company Docs Used:</strong> 
                        {analysis.companyDocumentsUsedSnapshot && analysis.companyDocumentsUsedSnapshot.length > 0 ? analysis.companyDocumentsUsedSnapshot.map(d => d.name).join(', ') : 'None'}
                        <br/>
                        <strong className="text-stone-600">Regulatory Items Used:</strong>
                        {analysis.austracInputsUsedSnapshot && analysis.austracInputsUsedSnapshot.length > 0 ? analysis.austracInputsUsedSnapshot.map(a => a.title).join(', ') : 'None'}
                    </>
                )}
                {analysis.type === 'deepDive' && analysis.selectedDocumentSnapshot && (
                    <>
                        <strong className="text-stone-600">Deep Dive Focus:</strong> {analysis.selectedDocumentSnapshot.name}
                        {analysis.groundingMetadata?.groundingChunks?.some(c => c.web?.uri) && (
                            <><br/><strong className="text-stone-600">Web Sources Consulted:</strong> Yes</>
                        )}
                    </>
                )}
              </div>


              <div className="flex flex-wrap gap-3 mt-4">
                <button
                  onClick={() => onSelectAnalysis(analysis.id)} /* App.tsx will handle routing to correct tab */
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-md shadow-sm transition-colors"
                >
                  View Details
                </button>
                <button
                  onClick={() => handleStartRename(analysis)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-md shadow-sm transition-colors"
                >
                  Rename
                </button>
                <button
                  onClick={() => onDeleteAnalysis(analysis.id)}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-md shadow-sm transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnalysisHistoryPage;