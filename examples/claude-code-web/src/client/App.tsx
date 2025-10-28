import { useCallback, useMemo, useState } from 'react'
import { useSetAtom } from 'jotai'

import { ChatHeader } from '@/components/chat/chat-header'
import {
  PromptInput,
  type PromptContext,
  type AttachedFile,
} from '@/components/prompt-input/prompt-input'
import type { FileSuggestion } from '@/components/prompt-input/mention-file-list'
import { MessagesPane } from '@/components/chat/messages-pane'
import { LeftSidebar } from '@/components/left-sidebar/left-sidebar'
import type { SessionSelectPayload } from '@/components/left-sidebar/types'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useWebSocket } from '@/hooks/use-web-socket'
import type {
  ClaudeConfig,
  ClaudeModelOption,
  UsageData,
  UserMessage,
} from '@/types/session'

import type { AttachmentPayload } from '@claude-agent-kit/messages'
import type { OutcomingMessage } from '@claude-agent-kit/server'
import { createSystemMessage } from '@/lib/chat-message-utils'
import {
  chatMessagesAtom,
  chatSessionInfoAtom,
} from '@/state/chat-atoms'
import {
  useChatSessionState,
  useOutcomingMessageHandler,
  useSelectChatSession,
  useChatSessionOptions,
} from '@/state/use-chat-session'

type ServerMessage =
  | { type: 'connected'; message?: string }
  | { type: 'error'; error?: string; code?: string }
  | OutcomingMessage
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

function isOutcomingServerMessage(
  payload: ServerMessage,
): payload is OutcomingMessage {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const type = (payload as { type?: unknown }).type
  if (typeof type !== 'string') {
    return false
  }

  return (
    type === 'message_added' ||
    type === 'messages_updated' ||
    type === 'session_state_changed'
  )
}

function App() {
  const { messages, sessionId, sessionInfo } = useChatSessionState()
  const setMessages = useSetAtom(chatMessagesAtom)
  const setSessionInfo = useSetAtom(chatSessionInfoAtom)
  const { isBusy, isLoading, options } = sessionInfo
  const permissionMode = options.permissionMode ?? 'default'
  const thinkingLevel = options.thinkingLevel ?? 'off'
  const selectChatSession = useSelectChatSession()
  const handleOutcomingMessage = useOutcomingMessageHandler()
  const [connectionMessage, setConnectionMessage] = useState<string | null>(
    null,
  )
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

  const handleInterrupt = useCallback(() => {
    setSessionInfo((previous) => ({
      ...previous,
      isBusy: false,
      isLoading: false,
    }))
  }, [setSessionInfo])

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

  const handleSessionSelect = useCallback(
    ({ sessionId: nextSessionId, projectId }: SessionSelectPayload) => {
      if (nextSessionId === sessionId) {
        return
      }
      selectChatSession({ sessionId: nextSessionId, projectId })
    },
    [selectChatSession, sessionId],
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
        setSessionInfo((previous) => ({
          ...previous,
          isBusy: false,
          isLoading: false,
        }))
        return
      }

      if (isOutcomingServerMessage(raw)) {
        handleOutcomingMessage(raw)
      }
    },
    [handleOutcomingMessage, setMessages, setSessionInfo],
  )

  const { isConnected, sendMessage, setSDKOptions } = useWebSocket({
    url: websocketUrl,
    onMessage: handleServerMessage,
  })

  const { setPermissionMode, setThinkingLevel } = useChatSessionOptions(
    setSDKOptions,
  )

  const isStreaming = isBusy || isLoading

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
      setSessionInfo((previous) => ({
        ...previous,
        isBusy: true,
      }))
      setAttachedFiles([])
    },
    [isConnected, sendMessage, sessionId, setAttachedFiles, setSessionInfo],
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
            <LeftSidebar
              selectedSessionId={sessionId}
              onSessionSelect={handleSessionSelect}
            />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel className="flex h-full flex-col">
            <MessagesPane messages={messages} isStreaming={isStreaming} />
            <div className="border-t px-6 py-4">
              <PromptInput
                messages={sessionMessages}
                permissionMode={permissionMode}
                onPermissionModeChange={setPermissionMode}
                isBusy={isStreaming}
                usageData={usageData}
                thinkingLevel={thinkingLevel}
                onThinkingLevelChange={setThinkingLevel}
                availableModels={claudeConfig.models}
                currentModel={modelSelection}
                selection={null}
                onInterrupt={handleInterrupt}
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
