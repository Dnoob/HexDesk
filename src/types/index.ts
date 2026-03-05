export interface ToolCallInfo {
  id: string
  name: string
  arguments: string
  result?: string
  status: "calling" | "done" | "error"
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  images?: string[]
  toolCalls?: ToolCallInfo[]
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
  systemPrompt: string
  workingDirectory: string
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

export type SkillCategory =
  | "writing"
  | "development"
  | "efficiency"
  | "translation"
  | "creativity"
  | "data"
  | "design"

export interface Skill {
  id: string
  name: string
  description: string
  icon: string
  category: SkillCategory
  instruction: string
  author?: string
  tags?: string[]
  builtin?: boolean
  demoPrompt?: string
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

export interface AgentStep {
  id: string
  description: string
  status: "pending" | "running" | "done" | "error"
  result?: string
}

export interface AgentPlan {
  steps: AgentStep[]
}
