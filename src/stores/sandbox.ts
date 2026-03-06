import { create } from "zustand"
import { invoke } from "@tauri-apps/api/core"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"
import type { SandboxStatus, DownloadProgress, AgentInfo } from "@/types"

interface SandboxState {
  status: SandboxStatus
  progress: DownloadProgress | null
  bootLog: string[]
  error: string | null
  agentInfo: AgentInfo | null

  init: () => Promise<UnlistenFn[]>
  start: () => Promise<void>
  stop: () => Promise<void>
  restart: () => Promise<void>
  setEnabled: (enabled: boolean) => Promise<void>
  mountWorkspace: (path: string) => Promise<void>
  cleanWorkspace: () => Promise<void>
}

export const useSandboxStore = create<SandboxState>((set) => ({
  status: "not_installed",
  progress: null,
  bootLog: [],
  error: null,
  agentInfo: null,

  init: async () => {
    try {
      const state = await invoke<{ status: string; [key: string]: unknown }>("sandbox_get_state")
      set({ status: state.status as SandboxStatus })
    } catch {
      // Backend may not have registered sandbox commands yet
    }

    const unlisteners: UnlistenFn[] = []

    unlisteners.push(
      await listen<{ status: SandboxStatus; message?: string }>("sandbox:state-changed", (event) => {
        const { status, message } = event.payload
        set({
          status,
          error: status === "error" ? (message ?? "Unknown error") : null,
        })
      })
    )

    unlisteners.push(
      await listen<DownloadProgress>("sandbox:download-progress", (event) => {
        set({ progress: event.payload })
      })
    )

    unlisteners.push(
      await listen<string>("sandbox:boot-log", (event) => {
        set((state) => ({
          bootLog: [...state.bootLog, event.payload],
        }))
      })
    )

    unlisteners.push(
      await listen<AgentInfo>("sandbox:agent-ready", (event) => {
        set({ agentInfo: event.payload })
      })
    )

    return unlisteners
  },

  start: async () => {
    await invoke("sandbox_start")
  },

  stop: async () => {
    await invoke("sandbox_stop")
  },

  restart: async () => {
    set({ bootLog: [], error: null })
    await invoke("sandbox_restart")
  },

  setEnabled: async (enabled: boolean) => {
    await invoke("sandbox_set_enabled", { enabled })
  },

  mountWorkspace: async (path: string) => {
    await invoke("sandbox_mount_workspace", { path })
  },

  cleanWorkspace: async () => {
    await invoke("sandbox_clean_workspace")
  },
}))
