import React from 'react';
import { ICONS } from '../constants.tsx';

interface PromptDisplayProps {
  systemPrompt: string;
  userPrompt: string;
}

const PromptDisplay: React.FC<PromptDisplayProps> = ({ systemPrompt, userPrompt }) => {
  return (
    <div className="mt-8 p-4 bg-stone-50 border border-stone-200 rounded-lg">
      <details className="group">
        <summary className="flex justify-between items-center cursor-pointer list-none text-lg font-semibold text-stone-700 hover:text-orange-600 transition-colors">
          Show Prompts Used for this Analysis
          <span className="transition-transform duration-200 group-open:rotate-180">
            {ICONS.chevronDown("w-5 h-5")}
          </span>
        </summary>
        <div className="mt-4 pt-4 border-t border-stone-200 space-y-4">
          <div>
            <h4 className="text-md font-semibold text-stone-600 mb-2">System Prompt</h4>
            <pre className="bg-stone-100 p-3 rounded-md text-xs text-stone-800 whitespace-pre-wrap font-sans overflow-x-auto scrollbar-thin scrollbar-thumb-stone-300 scrollbar-track-stone-100">
              {systemPrompt.trim()}
            </pre>
          </div>
          <div>
            <h4 className="text-md font-semibold text-stone-600 mb-2">User Prompt</h4>
            <pre className="bg-stone-100 p-3 rounded-md text-xs text-stone-800 whitespace-pre-wrap font-sans overflow-x-auto scrollbar-thin scrollbar-thumb-stone-300 scrollbar-track-stone-100">
              {userPrompt.trim()}
            </pre>
          </div>
        </div>
      </details>
    </div>
  );
};

export default PromptDisplay;
