import { useEffect } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useUIStore } from "@/stores/ui"
import { useChatStore } from "@/stores/chat"
import { useConfirmationStore } from "@/stores/confirmation"
import Sidebar from "@/components/sidebar/Sidebar"
import ChatArea from "@/components/chat/ChatArea"
import { ConfirmationCard } from "@/components/chat/ConfirmationCard"
import "./App.css"

function App() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)

  useEffect(() => {
    void useChatStore.getState().init()
    void useConfirmationStore.getState().listen()
  }, [])

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
