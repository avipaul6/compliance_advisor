
import React from 'react';
import { ICONS } from '../constants.tsx';


const Header: React.FC = () => {
  return (
    <header className="bg-white/90 backdrop-blur-md shadow-sm shadow-orange-200 sticky top-0 z-50 border-b border-orange-200">
      <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {ICONS.checkCircle("w-10 h-10 text-orange-500")}
          <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-500">
            Vera: Virtual Regulation Assistant - OFX
          </h1>
        </div>
        <a 
          href="https://ai.google.dev/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm text-stone-500 hover:text-orange-600 transition-colors"
        >
          Powered by Gemini
        </a>
      </div>
    </header>
  );
};

export default Header;