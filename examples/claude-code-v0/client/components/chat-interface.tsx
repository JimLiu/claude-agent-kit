import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { MessageRenderer } from "./message/message-renderer";
import type {
  AttachmentPayload,
  ChatMessage,
  ChatSessionState,
} from "../../shared/types/messages";
import { Wifi, WifiOff } from "lucide-react";
import { ThinkingIndicator } from "./message/thinking-indicator";
import { ChatInput } from "./chat/chat-input";
import type { ImageAttachment } from "@/components/ai-elements/prompt-input";
import { ResizableLayout } from "./resizable-layout";
import { PreviewPanel } from "./chat/preview-panel";

interface ChatInterfaceProps {
  isConnected: boolean;
  sendMessage: (message: any) => void;
  sessionState: ChatSessionState;
  sessionId: string | null;
  isLoading: boolean;
  workspaceFiles: Record<string, string>;
  isWorkspaceSyncing: boolean;
  onRequestWorkspaceSync: () => void;
}

export function ChatInterface({
  isConnected,
  sendMessage,
  sessionState,
  sessionId,
  isLoading,
  workspaceFiles,
  isWorkspaceSyncing,
  onRequestWorkspaceSync,
}: ChatInterfaceProps) {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [activePanel, setActivePanel] = useState<"chat" | "preview">("chat");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [sessionState.messages]);

  const handleSubmit = useCallback(
    (
      payload: { text: string; attachments: ImageAttachment[] },
      event: React.FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();
      if (isLoading || !isConnected) return;

      const trimmed = payload.text.trim();
      const hasAttachments = payload.attachments.length > 0;
      if (!trimmed && !hasAttachments) return;

      const serializedAttachments: AttachmentPayload[] = payload.attachments
        .map((attachment) => {
          try {
            const [meta, base64Payload] = attachment.dataUrl.split(",");
            if (!base64Payload) {
              console.error(
                "Invalid attachment data URL",
                attachment.file.name
              );
              return null;
            }
            const match = meta.match(/data:([^;]+)/);
            const mediaType =
              match && match[1]
                ? match[1].toLowerCase()
                : attachment.file.type || "application/octet-stream";

            return {
              id: attachment.id,
              name: attachment.file.name,
              mediaType,
              data: base64Payload,
            };
          } catch (error) {
            console.error("Failed to serialize attachment", error);
            return null;
          }
        })
        .filter((value): value is AttachmentPayload => value !== null);

      const outgoing: {
        type: "chat";
        content: string;
        sessionId?: string;
        attachments?: AttachmentPayload[];
      } = {
        type: "chat",
        content: payload.text,
      };

      if (sessionId) {
        outgoing.sessionId = sessionId;
      }

      if (serializedAttachments.length > 0) {
        outgoing.attachments = serializedAttachments;
      }

      sendMessage(outgoing);
      setMessage("");
      setAttachments([]);
    },
    [isConnected, isLoading, sendMessage, sessionId]
  );

  const messages: ChatMessage[] = sessionState.messages;
  const lastUserPrompt = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      if (msg.type !== "user") {
        continue;
      }
      for (const segment of msg.segments) {
        if (segment.kind === "text" && segment.block.text.trim().length > 0) {
          return segment.block.text;
        }
      }
    }
    return null;
  }, [messages]);
  const previewIsLoading = isLoading || isWorkspaceSyncing;

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
          <h1 className="text-lg font-semibold uppercase tracking-wider">
            {" "}
            <a href="/">Home</a>
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 pl-3 border-l border-gray-200">
              {isConnected ? (
                <>
                  <Wifi className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-green-600 uppercase font-medium">
                    Online
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-400 uppercase font-medium">
                    Offline
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {sessionState.lastError && (
        <div className="max-w-5xl mx-auto w-full px-4">
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {sessionState.lastError}
          </div>
        </div>
      )}
      <div className="flex flex-col h-[calc(100vh-64px-40px)] md:h-[calc(100vh-64px)]">
        <ResizableLayout
          className="flex-1 min-h-0"
          singlePanelMode={false}
          activePanel={activePanel === "chat" ? "left" : "right"}
          leftPanel={
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto p-3">
                <div className="max-w-5xl mx-auto">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-400 mt-12">
                      <p className="text-sm uppercase tracking-wider">
                        Start a conversation
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <MessageRenderer messages={messages} />
                      {isLoading && (
                        <div className="mt-2 flex h-7 items-center">
                          <div className="flex items-center">
                            <ThinkingIndicator size={14} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="border-t border-gray-200 bg-white p-3">
                <div className="max-w-5xl mx-auto">
                  <ChatInput
                    message={message}
                    setMessage={setMessage}
                    onSubmit={handleSubmit}
                    isLoading={isLoading}
                    isConnected={isConnected}
                    attachments={attachments}
                    onAttachmentsChange={setAttachments}
                    textareaRef={textareaRef}
                  />
                </div>
              </div>
            </div>
          }
          rightPanel={
            <PreviewPanel
              files={workspaceFiles}
              isLoading={previewIsLoading}
              lastPrompt={lastUserPrompt}
              onRefresh={onRequestWorkspaceSync}
              disabledRefresh={!sessionId || !isConnected}
            />
          }
        />
      </div>
    </div>
  );
}
