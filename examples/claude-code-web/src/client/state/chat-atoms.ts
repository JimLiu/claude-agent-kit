import { atom } from 'jotai'
import type { ChatMessage, SessionSDKOptions } from 'claude-agent-kit/types'

const createDefaultOptions = (): SessionSDKOptions => ({
  permissionMode: 'default',
  thinkingLevel: 'off',
})

export type ChatSessionInfo = {
  isBusy: boolean
  isLoading: boolean
  options: SessionSDKOptions
}

export const createDefaultChatSessionInfo = (): ChatSessionInfo => ({
  isBusy: false,
  isLoading: false,
  options: createDefaultOptions(),
})

export const chatMessagesAtom = atom<ChatMessage[]>([])
export const chatSessionIdAtom = atom<string | null>(null)
export const chatProjectIdAtom = atom<string | null>(null)
export const chatSessionInfoAtom = atom<ChatSessionInfo>(
  createDefaultChatSessionInfo(),
)
