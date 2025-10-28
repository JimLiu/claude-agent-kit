import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback } from 'react'

import { addNewSDKMessage, convertSDKMessages } from '@claude-agent-kit/messages'
import type {
  OutcomingMessage,
  SessionSDKOptions,
} from '@claude-agent-kit/server'

import type { PermissionMode, ThinkingLevel } from '@/types/session'

import { sortMessages } from '@/lib/chat-message-utils'

import {
  chatMessagesAtom,
  chatProjectIdAtom,
  chatSessionIdAtom,
  chatSessionInfoAtom,
  createDefaultChatSessionInfo,
} from './chat-atoms'

export function useChatSessionState() {
  const messages = useAtomValue(chatMessagesAtom)
  const sessionId = useAtomValue(chatSessionIdAtom)
  const sessionInfo = useAtomValue(chatSessionInfoAtom)

  return { messages, sessionId, sessionInfo }
}

export function useOutcomingMessageHandler() {
  const setSessionId = useSetAtom(chatSessionIdAtom)
  const setMessages = useSetAtom(chatMessagesAtom)
  const setSessionInfo = useSetAtom(chatSessionInfoAtom)

  return useCallback(
    (payload: OutcomingMessage) => {
      setSessionId(payload.sessionId ?? null)

      if (payload.type === 'message_added') {
        setMessages((previous) =>
          sortMessages(addNewSDKMessage(previous, payload.message)),
        )
        return
      }

      if (payload.type === 'messages_updated') {
        setMessages(sortMessages(convertSDKMessages(payload.messages)))
        return
      }

      if (payload.type === 'session_state_changed') {
        setSessionInfo((previous) => ({
          ...previous,
          ...payload.sessionState,
        }))
      }
    },
    [setMessages, setSessionId, setSessionInfo],
  )
}

export type ChatSessionSelectionPayload = {
  sessionId: string | null
  projectId: string | null
}

export function useSelectChatSession() {
  const setSessionId = useSetAtom(chatSessionIdAtom)
  const setProjectId = useSetAtom(chatProjectIdAtom)
  const setMessages = useSetAtom(chatMessagesAtom)
  const setSessionInfo = useSetAtom(chatSessionInfoAtom)

  return useCallback(
    ({ sessionId, projectId }: ChatSessionSelectionPayload) => {
      setSessionId(sessionId)
      setProjectId(projectId)
      setMessages([])
      setSessionInfo(createDefaultChatSessionInfo())
    },
    [setMessages, setProjectId, setSessionId, setSessionInfo],
  )
}

type SetSDKOptionsFn = (
  options: Partial<SessionSDKOptions>,
  sessionId?: string | null,
) => void

export function useChatSessionOptions(setSDKOptions: SetSDKOptionsFn) {
  const sessionId = useAtomValue(chatSessionIdAtom)
  const setSessionInfo = useSetAtom(chatSessionInfoAtom)

  const setSessionOptions = useCallback(
    (options: Partial<SessionSDKOptions>, broadcast = true) => {
      setSessionInfo((previous) => ({
        ...previous,
        options: {
          ...previous.options,
          ...options,
        },
      }))

      if (broadcast) {
        setSDKOptions(options, sessionId ?? null)
      }
    },
    [sessionId, setSDKOptions, setSessionInfo],
  )

  const setPermissionMode = useCallback(
    (mode: PermissionMode, broadcast = true) => {
      setSessionOptions({ permissionMode: mode }, broadcast)
    },
    [setSessionOptions],
  )

  const setThinkingLevel = useCallback(
    (level: ThinkingLevel, broadcast = true) => {
      setSessionOptions({ thinkingLevel: level }, broadcast)
    },
    [setSessionOptions],
  )

  return {
    setSessionOptions,
    setPermissionMode,
    setThinkingLevel,
  }
}
