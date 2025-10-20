import React from 'react';
import { UserMessage as UserMessageType, UserToolResultMessage } from './types';

interface UserMessageProps {
  message: UserMessageType | UserToolResultMessage;
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

export function UserMessage({ message }: UserMessageProps) {
  const isToolResult = 'content' in message && Array.isArray(message.content) && 
    message.content.some(c => typeof c === 'object' && 'tool_use_id' in c);

  if (isToolResult) {
    const toolResultMessage = message as UserToolResultMessage;
    return (
      <div className="mb-3 p-3 bg-gray-50 border border-gray-300">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Tool Result</span>
          </div>
          <span className="text-xs text-gray-400">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>
        
        {toolResultMessage.content.map((result, index) => (
          <div key={index} className="mt-2">
            <div className="text-xs text-gray-500 mb-1 font-mono">
              ID: {result.tool_use_id}
            </div>
            <pre className="text-xs bg-white p-2 border border-gray-200 overflow-x-auto whitespace-pre-wrap font-mono">
              {result.content}
            </pre>
          </div>
        ))}
      </div>
    );
  }

  const userMessage = message as UserMessageType;
  return (
    <div className="mb-3 p-3 bg-white border border-gray-200">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center">
          <span className="text-xs font-semibold text-gray-900 uppercase tracking-wider">USER</span>
        </div>
        <span className="text-xs text-gray-400">
          {formatTimestamp(message.timestamp)}
        </span>
      </div>
      
      <div className="text-sm text-gray-900 whitespace-pre-wrap">
        {userMessage.content}
      </div>
    </div>
  );
}