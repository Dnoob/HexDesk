import { create } from "zustand"
import { invoke } from "@tauri-apps/api/core"
import Database from "@tauri-apps/plugin-sql"
import type { ScheduledTask } from "@/types"

let db: Database | null = null

async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:hexdesk.db")
  }
  return db
}

interface ScheduledTaskRow {
  id: string
  name: string
  cron_expression: string
  prompt: string
  enabled: number
  last_run: number | null
  next_run: number | null
  created_at: number
}

function rowToTask(row: ScheduledTaskRow): ScheduledTask {
  return {
    id: row.id,
    name: row.name,
    cronExpression: row.cron_expression,
    prompt: row.prompt,
    enabled: row.enabled === 1,
    lastRun: row.last_run,
    nextRun: row.next_run,
    createdAt: row.created_at,
  }
}

interface SchedulerState {
  tasks: ScheduledTask[]
  loading: boolean

  loadTasks: () => Promise<void>
  createTask: (name: string, cronExpression: string, prompt: string) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  toggleTask: (id: string, enabled: boolean) => Promise<void>
}

export const useSchedulerStore = create<SchedulerState>((set, get) => ({
  tasks: [],
  loading: false,

  loadTasks: async () => {
    set({ loading: true })
    try {
      const d = await getDb()
      const rows = await d.select<ScheduledTaskRow[]>(
        "SELECT * FROM scheduled_tasks ORDER BY created_at DESC"
      )
      set({ tasks: rows.map(rowToTask) })
    } catch (e) {
      console.error("Failed to load scheduled tasks:", e)
    } finally {
      set({ loading: false })
    }
  },

  createTask: async (name, cronExpression, prompt) => {
    const nextRun = await invoke<number | null>("parse_cron_next_run", {
      cronExpression,
    })

    const task: ScheduledTask = {
      id: crypto.randomUUID(),
      name,
      cronExpression,
      prompt,
      enabled: true,
      lastRun: null,
      nextRun: nextRun,
      createdAt: Date.now(),
    }

    const d = await getDb()
    await d.execute(
      "INSERT INTO scheduled_tasks (id, name, cron_expression, prompt, enabled, last_run, next_run, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [task.id, task.name, task.cronExpression, task.prompt, 1, null, task.nextRun, task.createdAt]
    )

    set((state) => ({ tasks: [task, ...state.tasks] }))
  },

  deleteTask: async (id) => {
    const d = await getDb()
    await d.execute("DELETE FROM scheduled_tasks WHERE id = $1", [id])
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }))
  },

  toggleTask: async (id, enabled) => {
    let nextRun: number | null = null
    if (enabled) {
      const task = get().tasks.find((t) => t.id === id)
      if (task) {
        nextRun = await invoke<number | null>("parse_cron_next_run", {
          cronExpression: task.cronExpression,
        })
      }
    }

    const d = await getDb()
    await d.execute(
      "UPDATE scheduled_tasks SET enabled = $1, next_run = $2 WHERE id = $3",
      [enabled ? 1 : 0, nextRun, id]
    )
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, enabled, nextRun } : t
      ),
    }))
  },
}))
