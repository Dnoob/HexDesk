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
      systemPrompt: "你是 HexDesk AI 助手，一个强大的桌面级通用 AI 助手。你可以帮助用户进行文件操作、执行命令、生成文档等。请使用中文回复。",

      updateSettings: (partial) => set(partial),
    }),
    { name: "hexdesk-settings" },
  ),
)
