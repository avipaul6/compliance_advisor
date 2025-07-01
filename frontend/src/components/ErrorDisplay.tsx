import React from 'react';
import { ICONS } from '../constants';


interface ErrorDisplayProps {
  message: string;
  className?: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message, className = "" }) => {
  if (!message) return null;

  return (
    <div className={`bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg relative shadow-sm ${className}`} role="alert">
      <div className="flex items-center">
        {ICONS.exclamationTriangle("w-5 h-5 mr-2 text-red-500")}
        <strong className="font-semibold mr-1">Error:</strong>
        <span className="block sm:inline whitespace-pre-wrap">{message}</span>
      </div>
    </div>
  );
};

export default ErrorDisplay;