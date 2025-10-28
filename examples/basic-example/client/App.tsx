import React, { useState } from "react";
import { ChatInterface } from "./components/chat-interface";
import type { Message } from "./components/message/types";
import { ScreenshotModeProvider } from "./context/screenshot-mode-context";
import { useWebSocket } from "./hooks/useWebSocket";
import { convertSDKMessage, convertSDKMessages } from "./utils/message-adapter";

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Single WebSocket connection for all components
  const { isConnected, sendMessage } = useWebSocket({
    url: "ws://localhost:3000/ws",
    onMessage: (message) => {
      switch (message.type) {
        case "connected":
          console.log("Connected to server:", message.message);
          break;
        case "message_added": {
          if (typeof message.sessionId === "string") {
            setSessionId(message.sessionId);
          }
          const uiMessage = convertSDKMessage(message.message);
          if (uiMessage) {
            setMessages((prev) => {
              if (prev.some((existing) => existing.id === uiMessage.id)) {
                return prev;
              }
              return [...prev, uiMessage];
            });
            if (uiMessage.type !== "user") {
              setIsLoading(false);
            }
          }
          break;
        }
        case "messages_updated": {
          if (typeof message.sessionId === "string") {
            setSessionId(message.sessionId);
          }
          const uiMessages = convertSDKMessages(message.messages ?? []);
          setMessages(uiMessages);
          setIsLoading(false);
          break;
        }
        case "session_state_changed": {
          if (typeof message.sessionId === "string") {
            setSessionId(message.sessionId);
          }
          const sessionState = message.sessionState;
          if (sessionState && typeof sessionState.isBusy === "boolean") {
            setIsLoading(sessionState.isBusy);
          }
          break;
        }
        case "error": {
          console.error("Server error:", message.error);
          const errorMessage: Message = {
            id: `error-${Date.now()}`,
            type: "system",
            content: `Error: ${message.error}`,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, errorMessage]);
          setIsLoading(false);
          break;
        }
        default:
          break;
      }
    },
  });

  return (
    <ScreenshotModeProvider>
      <div className="flex h-screen bg-white">
        <div className="flex-1">
          <ChatInterface
            isConnected={isConnected}
            sendMessage={sendMessage}
            messages={messages}
            sessionId={sessionId}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
          />
        </div>
      </div>
    </ScreenshotModeProvider>
  );
};

export default App;
