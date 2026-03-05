import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Settings } from "@/types"

interface SettingsState extends Settings {
  updateSettings: (partial: Partial<Settings>) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      provider: "minimax",
      apiKey: "",
      model: "MiniMax-M2.5",
      baseUrl: "https://api.minimaxi.com/v1",
      maxTokens: 4096,
      temperature: 0.7,

      updateSettings: (partial) => set(partial),
    }),
    { name: "hexdesk-settings" },
  ),
)
