import { useState } from "react"
import { Plus, MessageSquare, Settings, Trash2, PanelLeftClose } from "lucide-react"
import { Button } from "@/components/ui/button"
import SettingsDialog from "@/components/settings/SettingsDialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useChatStore } from "@/stores/chat"
import { useUIStore } from "@/stores/ui"

export default function Sidebar() {
  const { conversations, currentConversationId, addConversation, selectConversation, deleteConversation } = useChatStore()
  const { toggleSidebar } = useUIStore()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="flex h-screen w-[260px] flex-shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Header */}
      <div className="flex items-center justify-between p-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={addConversation}>
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">New Chat</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={toggleSidebar}>
                <PanelLeftClose className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Close Sidebar</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1 px-2">
        <div className="flex flex-col gap-0.5">
          {conversations.map((conv) => {
            const isActive = conv.id === currentConversationId
            return (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
                }`}
                onClick={() => selectConversation(conv.id)}
              >
                <MessageSquare className="size-4 flex-shrink-0 opacity-60" />
                <span className="flex-1 truncate">{conv.title}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteConversation(conv.id)
                  }}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="mt-auto">
        <Separator />
        <div className="flex items-center justify-between p-3">
          <span className="text-xs font-medium text-muted-foreground">HexDesk</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => setSettingsOpen(true)}>
                  <Settings className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
