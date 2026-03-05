import { create } from "zustand"
import type { Conversation, Message } from "@/types"

interface ChatState {
  conversations: Conversation[]
  currentConversationId: string | null
  messages: Message[]

  addConversation: () => void
  selectConversation: (id: string) => void
  deleteConversation: (id: string) => void
  addMessage: (role: Message["role"], content: string) => void
}

function generateId(): string {
  return crypto.randomUUID()
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],

  addConversation: () => {
    const now = Date.now()
    const conv: Conversation = {
      id: generateId(),
      title: "New Chat",
      createdAt: now,
      updatedAt: now,
    }
    set((state) => ({
      conversations: [conv, ...state.conversations],
      currentConversationId: conv.id,
      messages: [],
    }))
  },

  selectConversation: (id) => {
    if (get().currentConversationId === id) return
    set({ currentConversationId: id, messages: [] })
  },

  deleteConversation: (id) => {
    set((state) => {
      const conversations = state.conversations.filter((c) => c.id !== id)
      const isCurrentDeleted = state.currentConversationId === id
      return {
        conversations,
        currentConversationId: isCurrentDeleted
          ? conversations[0]?.id ?? null
          : state.currentConversationId,
        messages: isCurrentDeleted ? [] : state.messages,
      }
    })
  },

  addMessage: (role, content) => {
    const msg: Message = {
      id: generateId(),
      role,
      content,
      createdAt: Date.now(),
    }
    set((state) => ({
      messages: [...state.messages, msg],
      conversations: state.conversations.map((c) =>
        c.id === state.currentConversationId
          ? { ...c, updatedAt: Date.now(), title: state.messages.length === 0 && role === "user" ? content.slice(0, 30) : c.title }
          : c,
      ),
    }))
  },
}))
