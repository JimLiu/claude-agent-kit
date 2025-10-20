import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatInterface } from "./components/chat-interface";
import { useWebSocket } from "./hooks/useWebSocket";
import { ScreenshotModeProvider } from "./context/screenshot-mode-context";
import type { ChatSessionState } from "../shared/types/messages";

function createInitialSessionState(): ChatSessionState {
  return {
    messages: [],
    usage: {
      totalTokens: 0,
      totalCost: 0,
      contextWindow: 0,
    },
    busy: false,
  };
}

function getSessionIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/s\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

const App: React.FC = () => {
  const [sessionState, setSessionState] = useState<ChatSessionState>(() =>
    createInitialSessionState(),
  );
  const [initialSessionId] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return getSessionIdFromPath(window.location.pathname);
  });
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [workspaceFiles, setWorkspaceFiles] = useState<Record<string, string>>({});
  const [isWorkspaceSyncing, setIsWorkspaceSyncing] = useState(false);
  const sessionIdRef = useRef<string | null>(initialSessionId);
  const activeSyncCountRef = useRef(0);

  const socketUrl = useMemo(() => {
    const base = "ws://localhost:3000/ws";
    if (initialSessionId) {
      return `${base}?sessionId=${encodeURIComponent(initialSessionId)}`;
    }
    return base;
  }, [initialSessionId]);

  const syncWorkspaceFiles = useCallback(async (targetSessionId?: string) => {
    const activeSessionId = targetSessionId ?? sessionIdRef.current;
    if (!activeSessionId) {
      return;
    }

    activeSyncCountRef.current += 1;
    setIsWorkspaceSyncing(true);

    try {
      const response = await fetch(
        `/api/workspace/sync?sessionId=${encodeURIComponent(activeSessionId)}`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(`Workspace sync failed (${response.status})`);
      }

      const data = (await response.json()) as Record<string, string>;

      if (sessionIdRef.current === activeSessionId) {
        setWorkspaceFiles(data);
      }
    } catch (error) {
      console.error("Failed to sync workspace files:", error);
    } finally {
      activeSyncCountRef.current -= 1;
      if (activeSyncCountRef.current <= 0) {
        activeSyncCountRef.current = 0;
        setIsWorkspaceSyncing(false);
      }
    }
  }, []);

  const handleSocketMessage = useCallback(
    (message: any) => {
      switch (message.type) {
        case "connected": {
          console.log("Connected to server:", message.message);
          if (message.sessionId) {
            setSessionId(message.sessionId);
          }
          break;
        }
        case "session":
        case "session_info": {
          if (message.sessionId) {
            setSessionId(message.sessionId);
          }
          break;
        }
        case "session_snapshot":
        case "session_update": {
          if (message.sessionId) {
            setSessionId(message.sessionId);
          }
          if (message.state) {
            setSessionState(message.state as ChatSessionState);
          }
          break;
        }
        case "workspace_update": {
          const targetSessionId =
            typeof message.sessionId === "string" ? message.sessionId : undefined;
          const filesPayload =
            message.files && typeof message.files === "object"
              ? (message.files as Record<string, string>)
              : undefined;
          const deletedFiles: string[] = Array.isArray(message.deletedFiles)
            ? message.deletedFiles.filter(
                (value): value is string => typeof value === "string",
              )
            : [];
          const reason =
            message.reason === "initial" || message.reason === "change"
              ? message.reason
              : "change";

          const appliesToCurrent =
            !targetSessionId || targetSessionId === sessionIdRef.current;

          if (appliesToCurrent) {
            if (filesPayload || deletedFiles.length > 0) {
              setWorkspaceFiles((prev) => {
                const base: Record<string, string> =
                  reason === "initial" ? {} : { ...prev };
                const next: Record<string, string> = { ...base };

                if (filesPayload) {
                  for (const [filePath, content] of Object.entries(filesPayload)) {
                    next[filePath] = content;
                  }
                }

                for (const filePath of deletedFiles) {
                  if (filePath in next) {
                    delete next[filePath];
                  }
                }

                return next;
              });
              setIsWorkspaceSyncing(false);
            } else {
              void syncWorkspaceFiles(targetSessionId);
            }
          }

          if (!filesPayload && appliesToCurrent) {
            void syncWorkspaceFiles(targetSessionId);
          }
          break;
        }
        case "error": {
          console.error("Server error:", message.error);
          setSessionState((prev) => ({
            ...prev,
            lastError:
              typeof message.error === "string"
                ? message.error
                : "Unknown error",
            busy: false,
          }));
          break;
        }
        default:
          console.log("Unhandled message from server", message);
      }
    },
    [syncWorkspaceFiles],
  );

  // Single WebSocket connection for all components
  const { isConnected, sendMessage } = useWebSocket({
    url: socketUrl,
    onMessage: handleSocketMessage,
  });

  useEffect(() => {
    sessionIdRef.current = sessionId;
    if (!sessionId) {
      setWorkspaceFiles({});
      return;
    }
    setWorkspaceFiles({});
    void syncWorkspaceFiles(sessionId);
  }, [sessionId, syncWorkspaceFiles]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const targetPath = `/s/${encodeURIComponent(sessionId)}`;
    if (window.location.pathname !== targetPath) {
      window.history.replaceState(null, "", targetPath);
    }
  }, [sessionId]);

  const isLoading = sessionState.busy;

  return (
    <ScreenshotModeProvider>
      <div className="flex h-screen bg-white">
        <div className="flex-1">
          <ChatInterface
            isConnected={isConnected}
            sendMessage={sendMessage}
            sessionState={sessionState}
            sessionId={sessionId}
            isLoading={isLoading}
            workspaceFiles={workspaceFiles}
            isWorkspaceSyncing={isWorkspaceSyncing}
            onRequestWorkspaceSync={() => {
              void syncWorkspaceFiles();
            }}
          />
        </div>
      </div>
    </ScreenshotModeProvider>
  );
};

export default App;
