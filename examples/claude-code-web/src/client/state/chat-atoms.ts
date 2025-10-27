import { atom } from 'jotai'
import type { ChatMessage } from 'claude-agent-kit/types'

import type { PermissionMode, ThinkingLevel } from '@/types/session'

export type ChatSessionInfo = {
  isBusy: boolean
  isLoading: boolean
  permissionMode: PermissionMode
  thinkingLevel: ThinkingLevel
}

export const createDefaultChatSessionInfo = (): ChatSessionInfo => ({
  isBusy: false,
  isLoading: false,
  permissionMode: 'default',
  thinkingLevel: 'off',
})

export const chatMessagesAtom = atom<ChatMessage[]>([])
export const chatSessionIdAtom = atom<string | null>(null)
export const chatProjectIdAtom = atom<string | null>(null)
export const chatSessionInfoAtom = atom<ChatSessionInfo>(
  createDefaultChatSessionInfo(),
)
