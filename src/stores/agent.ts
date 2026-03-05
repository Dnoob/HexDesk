import { create } from "zustand"

interface AgentState {
  isAgentMode: boolean
  toggleAgentMode: () => void
}

export const useAgentStore = create<AgentState>((set) => ({
  isAgentMode: false,
  toggleAgentMode: () => set((s) => ({ isAgentMode: !s.isAgentMode })),
}))
