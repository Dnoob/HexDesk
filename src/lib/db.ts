import Database from "@tauri-apps/plugin-sql"
import type { Conversation, Message } from "@/types"

let db: Database | null = null

async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:hexdesk.db")
  }
  return db
}

interface ConversationRow {
  id: string
  title: string
  created_at: number
  updated_at: number
}

interface MessageRow {
  id: string
  conversation_id: string
  role: "user" | "assistant"
  content: string
  created_at: number
}

export async function dbGetConversations(): Promise<Conversation[]> {
  const d = await getDb()
  const rows = await d.select<ConversationRow[]>(
    "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC"
  )
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}

export async function dbCreateConversation(conv: Conversation): Promise<void> {
  const d = await getDb()
  await d.execute(
    "INSERT INTO conversations (id, title, created_at, updated_at) VALUES ($1, $2, $3, $4)",
    [conv.id, conv.title, conv.createdAt, conv.updatedAt]
  )
}

export async function dbDeleteConversation(id: string): Promise<void> {
  const d = await getDb()
  await d.execute("DELETE FROM messages WHERE conversation_id = $1", [id])
  await d.execute("DELETE FROM conversations WHERE id = $1", [id])
}

export async function dbUpdateConversation(
  id: string,
  updates: { title?: string; updatedAt?: number }
): Promise<void> {
  const d = await getDb()
  if (updates.title !== undefined && updates.updatedAt !== undefined) {
    await d.execute(
      "UPDATE conversations SET title = $1, updated_at = $2 WHERE id = $3",
      [updates.title, updates.updatedAt, id]
    )
  } else if (updates.title !== undefined) {
    await d.execute("UPDATE conversations SET title = $1 WHERE id = $2", [
      updates.title,
      id,
    ])
  } else if (updates.updatedAt !== undefined) {
    await d.execute("UPDATE conversations SET updated_at = $1 WHERE id = $2", [
      updates.updatedAt,
      id,
    ])
  }
}

export async function dbGetMessages(
  conversationId: string
): Promise<Message[]> {
  const d = await getDb()
  const rows = await d.select<MessageRow[]>(
    "SELECT id, role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC",
    [conversationId]
  )
  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    createdAt: r.created_at,
  }))
}

export async function dbCreateMessage(
  msg: Message,
  conversationId: string
): Promise<void> {
  const d = await getDb()
  await d.execute(
    "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES ($1, $2, $3, $4, $5)",
    [msg.id, conversationId, msg.role, msg.content, msg.createdAt]
  )
}

export async function dbUpdateMessageContent(
  id: string,
  content: string
): Promise<void> {
  const d = await getDb()
  await d.execute("UPDATE messages SET content = $1 WHERE id = $2", [
    content,
    id,
  ])
}
