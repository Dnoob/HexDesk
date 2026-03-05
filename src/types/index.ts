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

export interface ScheduledTask {
  id: string
  name: string
  cronExpression: string
  prompt: string
  enabled: boolean
  lastRun: number | null
  nextRun: number | null
  createdAt: number
}

export interface SkillVariable {
  name: string
  label: string
  type: "text" | "select"
  options?: string[]
  placeholder?: string
}

export interface Skill {
  id: string
  name: string
  description: string
  icon: string
  prompt: string
  variables?: SkillVariable[]
  builtin?: boolean
}

export interface McpServerConfig {
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
}

export interface McpTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}
