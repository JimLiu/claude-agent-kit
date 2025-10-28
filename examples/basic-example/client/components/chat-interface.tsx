import React, { useState, useRef, useEffect } from 'react';
import { MessageRenderer } from './message/message-renderer';
import { Message } from './message/types';
import { Send, Wifi, WifiOff } from 'lucide-react';

interface ChatInterfaceProps {
  isConnected: boolean;
  sendMessage: (message: any) => void;
  messages: Message[];
  sessionId: string | null;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

export function ChatInterface({ isConnected, sendMessage, messages, sessionId, isLoading, setIsLoading }: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // Format last sync time
  const formatLastSync = (lastSync: string | null) => {
    if (!lastSync) return 'Never synced';
    
    const date = new Date(lastSync);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  
  
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || !isConnected) return;
    
    setInputValue('');
    setIsLoading(true);
    
    // Send message through WebSocket
    sendMessage({
      type: 'chat',
      content: inputValue,
      sessionId,
    });
  };
  
  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="flex-1 overflow-y-auto p-3">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
            <h1 className="text-lg font-semibold uppercase tracking-wider"> Agent</h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 pl-3 border-l border-gray-200">
                {isConnected ? (
                  <>
                    <Wifi className="w-3 h-3 text-green-600" />
                    <span className="text-xs text-green-600 uppercase font-medium">Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-400 uppercase font-medium">Offline</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 mt-12">
              <p className="text-sm uppercase tracking-wider">Start a conversation</p>
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((msg) => (
                <MessageRenderer key={msg.id} message={msg} />
              ))}
              {isLoading && (
                <MessageRenderer 
                  message={{
                    id: 'loading',
                    type: 'assistant',
                    content: [{ type: 'text', text: 'Processing...' }],
                    timestamp: new Date().toISOString(),
                  }}
                />
              )}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <div className="border-t border-gray-200 bg-white p-3">
        <form onSubmit={handleSubmit} className="max-w-5xl mx-auto">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={isConnected ? "Ask about your agent..." : "Waiting for connection..."}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 focus:border-gray-900 focus:outline-none"
              disabled={isLoading || !isConnected}
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim() || !isConnected}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-gray-900 text-white hover:bg-white hover:text-gray-900 border border-gray-900 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <Send size={14} />
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
