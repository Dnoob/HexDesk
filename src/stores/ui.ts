import { create } from "zustand"
import { persist } from "zustand/middleware"

type Theme = "dark" | "light" | "system"
type Page = "chat" | "skills"

interface UIState {
  sidebarOpen: boolean
  theme: Theme
  activePage: Page
  toggleSidebar: () => void
  setTheme: (theme: Theme) => void
  setActivePage: (page: Page) => void
}

function getSystemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function applyTheme(theme: Theme) {
  const isDark = theme === "system" ? getSystemPrefersDark() : theme === "dark"
  document.documentElement.classList.toggle("light", !isDark)
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: "dark",
      activePage: "chat",
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
      setActivePage: (page) => set({ activePage: page }),
    }),
    {
      name: "hexdesk-ui",
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme)
      },
    },
  ),
)
