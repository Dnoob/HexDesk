import { create } from "zustand"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import type { Conversation, Message, ChatMessage, ChunkPayload } from "@/types"
import { useSettingsStore } from "./settings"

interface ChatState {
  conversations: Conversation[]
  currentConversationId: string | null
  messages: Message[]
  isStreaming: boolean

  addConversation: () => void
  selectConversation: (id: string) => void
  deleteConversation: (id: string) => void
  addMessage: (role: Message["role"], content: string) => void
  appendToLastMessage: (content: string) => void
  sendMessage: (content: string) => Promise<void>
  stopStreaming: () => void
}

function generateId(): string {
  return crypto.randomUUID()
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  isStreaming: false,

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
          ? {
              ...c,
              updatedAt: Date.now(),
              title:
                state.messages.length === 0 && role === "user"
                  ? content.slice(0, 30)
                  : c.title,
            }
          : c,
      ),
    }))
  },

  appendToLastMessage: (content) => {
    set((state) => {
      const messages = [...state.messages]
      const lastMsg = messages[messages.length - 1]
      if (lastMsg && lastMsg.role === "assistant") {
        messages[messages.length - 1] = {
          ...lastMsg,
          content: lastMsg.content + content,
        }
      }
      return { messages }
    })
  },

  sendMessage: async (content) => {
    const state = get()

    if (!state.currentConversationId) {
      get().addConversation()
    }

    // Add user message
    get().addMessage("user", content)

    // Add empty assistant message as placeholder
    get().addMessage("assistant", "")

    set({ isStreaming: true })

    // Build messages array for API (exclude the empty assistant placeholder)
    const allMessages = get().messages
    const apiMessages: ChatMessage[] = allMessages
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content }))

    // Sync settings to backend before sending
    const settings = useSettingsStore.getState()
    try {
      await invoke("save_settings", {
        settings: {
          apiKey: settings.apiKey,
          model: settings.model,
          baseUrl: settings.baseUrl,
          maxTokens: settings.maxTokens,
          temperature: settings.temperature,
        },
      })
    } catch {
      // Settings sync failure is non-fatal
    }

    // Set up event listeners
    const unlistenChunk = await listen<ChunkPayload>("chat:chunk", (event) => {
      get().appendToLastMessage(event.payload.content)
    })

    const unlistenDone = await listen("chat:done", () => {
      // Done event received
    })

    try {
      await invoke("send_message", { messages: apiMessages })
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      const currentMessages = get().messages
      const lastMsg = currentMessages[currentMessages.length - 1]
      if (lastMsg && lastMsg.role === "assistant" && lastMsg.content === "") {
        // Replace empty placeholder with error
        get().appendToLastMessage(`Error: ${errMsg}`)
      } else {
        get().appendToLastMessage(`\n\nError: ${errMsg}`)
      }
    } finally {
      set({ isStreaming: false })
      unlistenChunk()
      unlistenDone()
    }
  },

  stopStreaming: () => {
    set({ isStreaming: false })
  },
}))
