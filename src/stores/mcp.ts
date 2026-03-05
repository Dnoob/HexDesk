import { create } from "zustand"
import { persist } from "zustand/middleware"
import { invoke } from "@tauri-apps/api/core"
import type { McpServerConfig, McpTool } from "@/types"

interface McpState {
  servers: McpServerConfig[]
  connectedTools: Record<string, McpTool[]>

  addServer: (config: McpServerConfig) => void
  removeServer: (name: string) => void
  connect: (name: string) => Promise<void>
  disconnect: (name: string) => Promise<void>
}

export const useMcpStore = create<McpState>()(
  persist(
    (set, get) => ({
      servers: [],
      connectedTools: {},

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
        }))
      },

      connect: async (name) => {
        const config = get().servers.find((s) => s.name === name)
        if (!config) throw new Error(`Server '${name}' not found`)

        const tools = await invoke<McpTool[]>("connect_mcp_server", { config })
        set((state) => ({
          connectedTools: { ...state.connectedTools, [name]: tools },
        }))
      },

      disconnect: async (name) => {
        await invoke("disconnect_mcp_server", { name })
        set((state) => ({
          connectedTools: Object.fromEntries(
            Object.entries(state.connectedTools).filter(([k]) => k !== name)
          ),
        }))
      },
    }),
    {
      name: "hexdesk-mcp",
      partialize: (state) => ({ servers: state.servers }),
    }
  )
)
