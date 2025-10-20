import React, { useState } from 'react';
import { SystemMessage as SystemMessageType } from './types';

interface SystemMessageProps {
  message: SystemMessageType;
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

export function SystemMessage({ message }: SystemMessageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const isInitMessage = message.metadata?.type === 'system' && message.metadata?.subtype === 'init';
  
  return (
    <div className="mb-4 p-4 bg-gray-50 border-l-4 border-gray-400 rounded-r-lg">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center">
          <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
          <span className="text-sm font-medium text-gray-700">System</span>
          {isInitMessage && (
            <span className="ml-2 px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded">
              Initialization
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {formatTimestamp(message.timestamp)}
        </span>
      </div>
      
      <div className="text-gray-700 text-sm mb-2">
        {message.content}
      </div>
      
      {message.metadata && (
        <div className="mt-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
          >
            {isExpanded ? '▼' : '▶'} View Metadata
          </button>
          
          {isExpanded && (
            <div className="mt-2 p-3 bg-white rounded border text-xs">
              <pre className="overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(message.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}