import { create } from "zustand"
import { persist } from "zustand/middleware"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import type { McpServerConfig, McpTool } from "@/types"

type McpServerStatus = "connected" | "reconnecting" | "disconnected" | "error"

interface McpState {
  servers: McpServerConfig[]
  connectedTools: Record<string, McpTool[]>
  serverStatus: Record<string, McpServerStatus>

  addServer: (config: McpServerConfig) => void
  removeServer: (name: string) => void
  connect: (name: string) => Promise<void>
  disconnect: (name: string) => Promise<void>
  updateServer: (name: string, config: McpServerConfig) => Promise<void>
  initStatusListener: () => Promise<() => void>
}

export const useMcpStore = create<McpState>()(
  persist(
    (set, get) => ({
      servers: [],
      connectedTools: {},
      serverStatus: {},

      addServer: (config) => {
        set((state) => ({
          servers: [...state.servers.filter((s) => s.name !== config.name), config],
        }))
      },

      removeServer: (name) => {
        const state = get()
        if (state.connectedTools[name]) {
          invoke("disconnect_mcp_server", { name }).catch((e) =>
            console.error("Failed to disconnect MCP server:", e)
          )
        }
        set((state) => ({
          servers: state.servers.filter((s) => s.name !== name),
          connectedTools: Object.fromEntries(
            Object.entries(state.connectedTools).filter(([k]) => k !== name)
          ),
          serverStatus: Object.fromEntries(
            Object.entries(state.serverStatus).filter(([k]) => k !== name)
          ),
        }))
      },

      connect: async (name) => {
        const config = get().servers.find((s) => s.name === name)
        if (!config) throw new Error(`Server '${name}' not found`)

        set((state) => ({
          serverStatus: { ...state.serverStatus, [name]: "reconnecting" as const },
        }))

        try {
          const tools = await invoke<McpTool[]>("connect_mcp_server", { config })
          set((state) => ({
            connectedTools: { ...state.connectedTools, [name]: tools },
            serverStatus: { ...state.serverStatus, [name]: "connected" as const },
          }))
        } catch (e) {
          set((state) => ({
            serverStatus: { ...state.serverStatus, [name]: "error" as const },
          }))
          throw e
        }
      },

      disconnect: async (name) => {
        await invoke("disconnect_mcp_server", { name })
        set((state) => ({
          connectedTools: Object.fromEntries(
            Object.entries(state.connectedTools).filter(([k]) => k !== name)
          ),
          serverStatus: { ...state.serverStatus, [name]: "disconnected" as const },
        }))
      },

      updateServer: async (name, config) => {
        set((state) => ({
          servers: state.servers.map((s) => (s.name === name ? config : s)),
          serverStatus: { ...state.serverStatus, [name]: "reconnecting" as const },
        }))

        try {
          const tools = await invoke<McpTool[]>("replace_mcp_client", { name, config })
          set((state) => ({
            connectedTools: { ...state.connectedTools, [name]: tools },
            serverStatus: { ...state.serverStatus, [name]: "connected" as const },
          }))
        } catch (e) {
          set((state) => ({
            serverStatus: { ...state.serverStatus, [name]: "error" as const },
          }))
          throw e
        }
      },

      initStatusListener: async () => {
        const unlisten = await listen<{
          serverName: string
          status: McpServerStatus
          error?: string
        }>("mcp:status", (event) => {
          set((state) => ({
            serverStatus: {
              ...state.serverStatus,
              [event.payload.serverName]: event.payload.status,
            },
          }))
        })
        return unlisten
      },
    }),
    {
      name: "hexdesk-mcp",
      partialize: (state) => ({ servers: state.servers }),
    }
  )
)
