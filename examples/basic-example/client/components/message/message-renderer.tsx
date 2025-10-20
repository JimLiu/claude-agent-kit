import React from 'react';
import { Message } from './types';
import { UserMessage } from './user-message';
import { SystemMessage } from './system-message';
import { AssistantMessage } from './assistant-message';

interface MessageRendererProps {
  message: Message;
}

export function MessageRenderer({ message }: MessageRendererProps) {
  switch (message.type) {
    case 'user':
      return <UserMessage message={message} />;
    
    case 'system':
      return <SystemMessage message={message} />;
    
    case 'assistant':
      return <AssistantMessage message={message} />;
    
    default:
      return (
        <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
          <div className="text-red-700">
            Unknown message type: {(message as any).type}
          </div>
          <pre className="text-sm mt-2 text-gray-600">
            {JSON.stringify(message, null, 2)}
          </pre>
        </div>
      );
  }
}

export * from './types';
export { UserMessage } from './user-message';
export { SystemMessage } from './system-message';
export { AssistantMessage } from './assistant-message';
