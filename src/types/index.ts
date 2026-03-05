export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  images?: string[]
  createdAt: number
}

export interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

export interface Settings {
  provider: string
  apiKey: string
  model: string
  baseUrl: string
  maxTokens: number
  temperature: number
}

export type ChatMessageContent = string | ChatContentPart[]

export interface ChatContentPart {
  type: "text" | "image_url"
  text?: string
  image_url?: { url: string }
}

export interface ChatMessage {
  role: string
  content: ChatMessageContent
}

export interface ChunkPayload {
  content: string
}

export interface ConfirmationRequest {
  id: string
  actionType: "file_read" | "file_write" | "shell_execute" | "file_delete"
  title: string
  description: string
  details?: string
}
