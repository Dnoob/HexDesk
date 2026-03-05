import { create } from "zustand"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import type { Conversation, Message, ChatMessage, ChatContentPart, ChunkPayload, ToolCallInfo } from "@/types"
import { useSettingsStore } from "./settings"
import { useAgentStore } from "./agent"
import {
  dbGetConversations,
  dbCreateConversation,
  dbDeleteConversation,
  dbUpdateConversation,
  dbGetMessages,
  dbCreateMessage,
  dbUpdateMessageContent,
} from "@/lib/db"

interface ChatState {
  conversations: Conversation[]
  currentConversationId: string | null
  messages: Message[]
  isStreaming: boolean
  initialized: boolean

  init: () => Promise<void>
  addConversation: () => void
  selectConversation: (id: string) => void
  deleteConversation: (id: string) => void
  addMessage: (role: Message["role"], content: string, images?: string[]) => void
  appendToLastMessage: (content: string) => void
  sendMessage: (content: string, images?: string[]) => Promise<void>
  stopStreaming: () => void
  addToolCall: (tc: { id: string; function: { name: string; arguments: string } }) => void
  updateToolCallResult: (toolCallId: string, result: string) => void
}

function generateId(): string {
  return crypto.randomUUID()
}

function buildChatMessageContent(content: string, images?: string[]): string | ChatContentPart[] {
  if (!images || images.length === 0) return content
  const parts: ChatContentPart[] = images.map((url) => ({
    type: "image_url" as const,
    image_url: { url },
  }))
  if (content) {
    parts.push({ type: "text" as const, text: content })
  }
  return parts
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  isStreaming: false,
  initialized: false,

  init: async () => {
    if (get().initialized) return
    try {
      const conversations = await dbGetConversations()
      set({ conversations, initialized: true })
    } catch (e) {
      console.error("Failed to load conversations from DB:", e)
      set({ initialized: true })
    }
  },

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
    dbCreateConversation(conv).catch((e) =>
      console.error("Failed to save conversation to DB:", e)
    )
  },

  selectConversation: (id) => {
    if (get().currentConversationId === id) return
    set({ currentConversationId: id, messages: [] })
    dbGetMessages(id)
      .then((messages) => {
        if (get().currentConversationId === id) {
          set({ messages })
        }
      })
      .catch((e) => console.error("Failed to load messages from DB:", e))
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
    dbDeleteConversation(id).catch((e) =>
      console.error("Failed to delete conversation from DB:", e)
    )
  },

  addMessage: (role, content, images) => {
    const msg: Message = {
      id: generateId(),
      role,
      content,
      images,
      createdAt: Date.now(),
    }
    const convId = get().currentConversationId
    let updatedTitle: string | undefined

    set((state) => {
      const isFirstUserMessage =
        state.messages.length === 0 && role === "user"
      const newTitle = isFirstUserMessage ? content.slice(0, 30) : undefined
      if (newTitle) updatedTitle = newTitle

      return {
        messages: [...state.messages, msg],
        conversations: state.conversations.map((c) =>
          c.id === state.currentConversationId
            ? {
                ...c,
                updatedAt: Date.now(),
                title: newTitle ?? c.title,
              }
            : c
        ),
      }
    })

    if (convId) {
      dbCreateMessage(msg, convId).catch((e) =>
        console.error("Failed to save message to DB:", e)
      )
      if (updatedTitle) {
        dbUpdateConversation(convId, {
          title: updatedTitle,
          updatedAt: Date.now(),
        }).catch((e) =>
          console.error("Failed to update conversation title in DB:", e)
        )
      } else {
        dbUpdateConversation(convId, { updatedAt: Date.now() }).catch((e) =>
          console.error("Failed to update conversation in DB:", e)
        )
      }
    }
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

  sendMessage: async (content, images) => {
    const state = get()

    if (!state.currentConversationId) {
      get().addConversation()
    }

    // Add user message
    get().addMessage("user", content, images)

    // Add empty assistant message as placeholder
    get().addMessage("assistant", "")

    set({ isStreaming: true })

    // Build messages array for API (exclude the empty assistant placeholder)
    const allMessages = get().messages
    const systemPrompt = useSettingsStore.getState().systemPrompt
    const agentPrompt = useAgentStore.getState().isAgentMode
      ? "\n\n当用户给出复杂任务时，你应该：\n1. 先分析任务，制定一个分步执行计划\n2. 使用以下 JSON 格式输出计划：\n```json\n{\"plan\": [{\"step\": 1, \"description\": \"步骤描述\"}, ...]}\n```\n3. 然后逐步执行计划中的每个步骤，使用可用的工具完成\n4. 每完成一个步骤，报告进度"
      : ""
    const apiMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt + agentPrompt },
      ...allMessages.slice(0, -1).map((m) => ({
        role: m.role,
        content: buildChatMessageContent(m.content, m.images),
      })),
    ]

    // Sync settings to backend before sending
    const settings = useSettingsStore.getState()
    try {
      await invoke("save_settings", {
        settings: {
          provider: settings.provider,
          apiKey: settings.apiKey,
          model: settings.model,
          baseUrl: settings.baseUrl,
          maxTokens: settings.maxTokens,
          temperature: settings.temperature,
          systemPrompt: settings.systemPrompt,
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

    const unlistenToolCall = await listen<{ id: string; function: { name: string; arguments: string } }>(
      "chat:tool_call",
      (event) => {
        get().addToolCall(event.payload)
      }
    )

    const unlistenToolResult = await listen<{ tool_call_id: string; result: string }>(
      "chat:tool_result",
      (event) => {
        get().updateToolCallResult(event.payload.tool_call_id, event.payload.result)
      }
    )

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
      unlistenToolCall()
      unlistenToolResult()

      // Save final assistant message to DB
      const convId = get().currentConversationId
      const msgs = get().messages
      const lastMsg = msgs[msgs.length - 1]
      if (convId && lastMsg && lastMsg.role === "assistant") {
        dbUpdateMessageContent(lastMsg.id, lastMsg.content).catch((e) =>
          console.error("Failed to update message content in DB:", e)
        )
      }
    }
  },

  stopStreaming: () => {
    set({ isStreaming: false })
  },

  addToolCall: (tc) => {
    set((state) => {
      const messages = [...state.messages]
      const last = messages[messages.length - 1]
      if (last?.role === "assistant") {
        const newToolCall: ToolCallInfo = {
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
          status: "calling",
        }
        messages[messages.length - 1] = {
          ...last,
          toolCalls: [...(last.toolCalls ?? []), newToolCall],
        }
      }
      return { messages }
    })
  },

  updateToolCallResult: (toolCallId, result) => {
    set((state) => {
      const messages = [...state.messages]
      const last = messages[messages.length - 1]
      if (last?.role === "assistant" && last.toolCalls) {
        messages[messages.length - 1] = {
          ...last,
          toolCalls: last.toolCalls.map((tc) =>
            tc.id === toolCallId ? { ...tc, result, status: "done" as const } : tc
          ),
        }
      }
      return { messages }
    })
  },
}))
