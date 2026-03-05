export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: number
}

export interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

export interface Settings {
  apiKey: string
  model: string
  baseUrl: string
  maxTokens: number
  temperature: number
}

export interface ChatMessage {
  role: string
  content: string
}

export interface ChunkPayload {
  content: string
}
