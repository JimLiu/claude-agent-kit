import { useCallback, useMemo, useState } from 'react'

import { ChatHeader } from '@/components/chat/chat-header'
import {
  PromptInput,
  type PromptContext,
  type AttachedFile,
} from '@/components/prompt-input/prompt-input'
import type { FileSuggestion } from '@/components/prompt-input/mention-file-list'
import { MessagesPane } from '@/components/chat/messages-pane'
import { LeftSidebar } from '@/components/left-sidebar/left-sidebar'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useWebSocket } from '@/hooks/use-web-socket'
import type {
  ClaudeConfig,
  ClaudeModelOption,
  PermissionMode,
  Session,
  ThinkingLevel,
  UsageData,
  UserMessage,
} from '@/types/session'

import { ChatMessage } from '../ccsdk/chat-message'
import type { AttachmentPayload, ToolResultContentBlock } from '../ccsdk/types'
import {
  SerializedChatMessage,
  createSystemMessage,
  hydrateChatMessage,
  sortMessages,
  updateToolResult,
} from '@/lib/chat-message-utils'

type SessionBroadcast =
  | {
      type: 'session_info'
      sessionId: string
      messageCount: number
      isActive: boolean
    }
  | {
      type: 'messages_loaded'
      sessionId: string
      messages: SerializedChatMessage[]
    }
  | {
      type: 'message_added'
      sessionId: string
      message: SerializedChatMessage
    }
  | {
      type: 'message_updated'
      sessionId: string
      message: SerializedChatMessage
    }
  | {
      type: 'message_removed'
      sessionId: string
      messageId: string
    }
  | {
      type: 'tool_result_updated'
      sessionId: string
      messageId: string
      toolUseId: string
      result: ToolResultContentBlock
    }

type ServerMessage =
  | { type: 'connected'; message?: string }
  | { type: 'error'; error?: string; code?: string }
  | {
      type: 'session_message'
      sessionId: string
      message: SessionBroadcast
    }
  | Record<string, unknown>

type CommandAction = {
  id: string
  label: string
  description?: string
  hasChevron?: boolean
}

type CommandEntry = {
  action: CommandAction
  section: string
  handler: () => void
}

async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Failed to read file'))
        return
      }
      const [, base64] = result.split(',', 2)
      if (!base64) {
        reject(new Error('Invalid data URI'))
        return
      }
      resolve(base64)
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('Unable to read file'))
    }
    reader.readAsDataURL(file)
  })
}

async function buildAttachmentPayloads(
  attachments: AttachedFile[],
): Promise<AttachmentPayload[]> {
  const payloads: AttachmentPayload[] = []
  for (const { file } of attachments) {
    try {
      const data = await readFileAsBase64(file)
      payloads.push({
        name: file.name,
        mediaType: file.type || 'application/octet-stream',
        data,
      })
    } catch (error) {
      console.error('Failed to serialize attachment for upload:', error)
    }
  }
  return payloads
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [connectionMessage, setConnectionMessage] = useState<string | null>(
    null,
  )
  const [permissionMode, setPermissionModeState] =
    useState<PermissionMode>('default')
  const [thinkingLevel, setThinkingLevel] =
    useState<ThinkingLevel>('off')
  const [modelSelection, setModelSelection] = useState<string | null>(null)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [commandEntries, setCommandEntries] = useState<Map<string, CommandEntry>>(
    () => new Map(),
  )

  const usageData = useMemo<UsageData>(
    () => ({
      totalTokens: 0,
      totalCost: 0,
      contextWindow: 0,
    }),
    [],
  )

  const claudeConfig = useMemo<ClaudeConfig>(
    () => ({
      models: [],
    }),
    [],
  )

  const sessionMessages = useMemo<UserMessage[]>(() => {
    return messages.map((message) => ({
      type: message.type,
      content: message.content.map((part) => {
        const block = part.content
        if (block.type === 'text') {
          return {
            content: {
              type: 'text',
              text: block.text ?? '',
            },
          }
        }
        if (block.type === 'tool_result') {
          const resultContent = block.content
          if (typeof resultContent === 'string') {
            return {
              content: {
                type: 'text',
                text: resultContent,
              },
            }
          }
        }
        return { content: undefined }
      }),
    }))
  }, [messages])

  const handleSetPermissionMode = useCallback(
    (mode: PermissionMode) => {
      setPermissionModeState(mode)
    },
    [],
  )

  const handleInterrupt = useCallback(() => {
    setIsStreaming(false)
  }, [])

  const handleModelSelected = useCallback((model: ClaudeModelOption) => {
    setModelSelection(model.value)
  }, [])

  const handleToggleIncludeSelection = useCallback(() => {}, [])

  const handleAddFiles = useCallback((files: FileList) => {
    setAttachedFiles((previous) => [
      ...previous,
      ...Array.from(files).map((file) => ({ file })),
    ])
  }, [])

  const handleRemoveFile = useCallback((index: number) => {
    setAttachedFiles((previous) =>
      previous.filter((_, fileIndex) => fileIndex !== index),
    )
  }, [])

  const handleListFiles = useCallback(
    async (_query: string): Promise<FileSuggestion[]> => {
      return []
    },
    [],
  )

  const supportsSpeechRecognition = useMemo(() => {
    if (typeof window === 'undefined') {
      return false
    }
    const candidate = window as unknown as Record<string, unknown>
    return (
      'SpeechRecognition' in candidate ||
      'webkitSpeechRecognition' in candidate
    )
  }, [])

  const safeFocus = useCallback((element: HTMLElement) => {
    try {
      element.focus({ preventScroll: true })
    } catch {
      element.focus()
    }
  }, [])

  const commandRegistry = useMemo(() => {
    return {
      getCommandsBySection: () => {
        const sections: Record<string, CommandAction[]> = {}
        commandEntries.forEach(({ action, section }) => {
          const existing = sections[section] ?? []
          sections[section] = [...existing, action]
        })
        return sections
      },
      registerAction: (
        action: CommandAction,
        section: string,
        handler: () => void,
      ) => {
        setCommandEntries((previous) => {
          if (previous.has(action.id)) {
            return previous
          }
          const next = new Map(previous)
          next.set(action.id, { action, section, handler })
          return next
        })
      },
      executeCommand: (id: string) => {
        const entry = commandEntries.get(id)
        entry?.handler()
      },
    }
  }, [commandEntries, setCommandEntries])

  const promptContext = useMemo<PromptContext>(
    () => ({
      commandRegistry,
      safeFocus,
      supportsSpeechRecognition,
    }),
    [commandRegistry, safeFocus, supportsSpeechRecognition],
  )

  const websocketUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return null
    }

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host = window.location.host
    return `${protocol}://${host}/ws`
  }, [])

  const handleSessionMessage = useCallback(
    (incomingSessionId: string, payload: SessionBroadcast) => {
      setSessionId(incomingSessionId)

      if (payload.type === 'session_info') {
        setIsStreaming(payload.isActive)
        return
      }

      if (payload.type === 'messages_loaded') {
        const hydrated = payload.messages
          .map((message) => hydrateChatMessage(message))
          .filter((message) => !message.isEmpty)

        setMessages(sortMessages(hydrated))
        setIsStreaming(false)
        return
      }

      if (payload.type === 'message_added') {
        const nextMessage = hydrateChatMessage(payload.message)
        if (nextMessage.isEmpty) {
          return
        }

        setMessages((previous) => {
          const exists = previous.some(
            (message) => message.id === nextMessage.id,
          )
          if (exists) {
            return sortMessages(
              previous.map((message) =>
                message.id === nextMessage.id ? nextMessage : message,
              ),
            )
          }

          return sortMessages([...previous, nextMessage])
        })
        return
      }

      if (payload.type === 'message_updated') {
        const updatedMessage = hydrateChatMessage(payload.message)
        setMessages((previous) =>
          previous.map((message) =>
            message.id === updatedMessage.id ? updatedMessage : message,
          ),
        )
        return
      }

      if (payload.type === 'message_removed') {
        setMessages((previous) =>
          previous.filter((message) => message.id !== payload.messageId),
        )
        return
      }

      if (payload.type === 'tool_result_updated') {
        setMessages((previous) =>
          previous.map((message) => {
            if (message.id !== payload.messageId) {
              return message
            }
            return updateToolResult(message, payload.toolUseId, payload.result)
          }),
        )
      }
    },
    [],
  )

  const handleServerMessage = useCallback(
    (raw: ServerMessage) => {
      if (raw.type === 'connected') {
        setConnectionMessage(
          raw.message ?? 'Connected to Claude Code WebSocket server.',
        )
        return
      }

      if (raw.type === 'error') {
        const errorMessage =
          raw.error ??
          'An unknown error occurred while communicating with the server.'
        setMessages((previous) => [
          ...previous,
          createSystemMessage(`Error: ${errorMessage}`),
        ])
        setIsStreaming(false)
        return
      }

      if (raw.type === 'session_message' && raw.message) {
        handleSessionMessage(raw.sessionId, raw.message)
      }
    },
    [handleSessionMessage],
  )

  const { isConnected, sendMessage } = useWebSocket({
    url: websocketUrl,
    onMessage: handleServerMessage,
  })

  const session = useMemo<Session>(
    () => ({
      messages: { value: sessionMessages },
      permissionMode: { value: permissionMode },
      setPermissionMode: handleSetPermissionMode,
      busy: { value: isStreaming },
      selection: { value: null },
      usageData: { value: usageData },
      claudeConfig: { value: claudeConfig },
      modelSelection: { value: modelSelection },
      config: {
        value: modelSelection ? { modelSetting: modelSelection } : null,
      },
      thinkingLevel: { value: thinkingLevel },
      setThinkingLevel,
      interrupt: handleInterrupt,
    }),
    [
      claudeConfig,
      handleInterrupt,
      handleSetPermissionMode,
      isStreaming,
      modelSelection,
      permissionMode,
      sessionMessages,
      setThinkingLevel,
      thinkingLevel,
      usageData,
    ],
  )

  const handlePromptSubmit = useCallback(
    async (message: string, attachments: AttachedFile[]) => {
      const trimmed = message.trim()
      if (!trimmed || !isConnected) {
        return
      }

      let attachmentPayloads: AttachmentPayload[] | undefined
      if (attachments.length > 0) {
        const serialized = await buildAttachmentPayloads(attachments)
        if (serialized.length > 0) {
          attachmentPayloads = serialized
        }
      }

      sendMessage({
        type: 'chat',
        content: trimmed,
        sessionId,
        attachments: attachmentPayloads,
      })
      setIsStreaming(true)
      setAttachedFiles([])
    },
    [isConnected, sendMessage, sessionId, setAttachedFiles],
  )

  return (
    <div className="flex h-svh w-full flex-col">
      <ChatHeader
        sessionId={sessionId}
        isConnected={isConnected}
        connectionMessage={connectionMessage}
      />

      <main className="flex-1 overflow-hidden px-4 py-4">
        <ResizablePanelGroup
          direction="horizontal"
          className="flex h-full w-full overflow-hidden rounded-xl border bg-background"
        >
          <ResizablePanel
            defaultSize={22}
            minSize={16}
            maxSize={32}
            className="max-w-[360px] min-w-[260px]"
          >
            <LeftSidebar selectedSessionId={sessionId} />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel className="flex h-full flex-col">
            <MessagesPane messages={messages} isStreaming={isStreaming} />
            <div className="border-t px-6 py-4">
              <PromptInput
                session={session}
                onSubmit={handlePromptSubmit}
                context={promptContext}
                placeholder={
                  isConnected
                    ? 'Ask Claude for help…'
                    : 'Waiting for connection…'
                }
                onListFiles={handleListFiles}
                onRemoveFile={handleRemoveFile}
                onAddFiles={handleAddFiles}
                attachedFiles={attachedFiles}
                includeSelection={false}
                onToggleIncludeSelection={handleToggleIncludeSelection}
                onModelSelected={handleModelSelected}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </div>
  )
}

export default App
