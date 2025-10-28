import { atom } from 'jotai'
import type { ChatMessage } from '@claude-agent-kit/messages'
import type { SessionSDKOptions } from '@claude-agent-kit/server'

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
