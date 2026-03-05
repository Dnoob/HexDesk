import { useEffect } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useUIStore, applyTheme } from "@/stores/ui"
import { useChatStore } from "@/stores/chat"
import { useConfirmationStore } from "@/stores/confirmation"
import Sidebar from "@/components/sidebar/Sidebar"
import ChatArea from "@/components/chat/ChatArea"
import { ConfirmationCard } from "@/components/chat/ConfirmationCard"
import "./App.css"

function App() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const theme = useUIStore((s) => s.theme)

  useEffect(() => {
    void useChatStore.getState().init()
    void useConfirmationStore.getState().listen()
  }, [])

  // Apply theme on mount and when system preference changes
  useEffect(() => {
    applyTheme(theme)
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      const handler = () => applyTheme("system")
      mq.addEventListener("change", handler)
      return () => mq.removeEventListener("change", handler)
    }
  }, [theme])

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden">
        {sidebarOpen && <Sidebar />}
        <ChatArea />
      </div>
      <ConfirmationCard />
    </TooltipProvider>
  )
}

export default App
