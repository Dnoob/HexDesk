import { TooltipProvider } from "@/components/ui/tooltip"
import { useUIStore } from "@/stores/ui"
import Sidebar from "@/components/sidebar/Sidebar"
import ChatArea from "@/components/chat/ChatArea"
import "./App.css"

function App() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden">
        {sidebarOpen && <Sidebar />}
        <ChatArea />
      </div>
    </TooltipProvider>
  )
}

export default App
