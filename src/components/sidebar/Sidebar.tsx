import { useMemo, useState } from "react"
import { Plus, Search, Trash2, PanelLeftClose, Settings, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import SettingsDialog from "@/components/settings/SettingsDialog"
import { useChatStore } from "@/stores/chat"
import { useUIStore } from "@/stores/ui"

function groupByDate(conversations: { id: string; title: string; updatedAt: number }[]) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86400000

  const groups: { label: string; items: typeof conversations }[] = [
    { label: "今天", items: [] },
    { label: "昨天", items: [] },
    { label: "更早", items: [] },
  ]

  for (const conv of conversations) {
    if (conv.updatedAt >= todayStart) groups[0].items.push(conv)
    else if (conv.updatedAt >= yesterdayStart) groups[1].items.push(conv)
    else groups[2].items.push(conv)
  }

  return groups.filter((g) => g.items.length > 0)
}

export default function Sidebar() {
  const { conversations, currentConversationId, addConversation, selectConversation, deleteConversation } =
    useChatStore()
  const { toggleSidebar } = useUIStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations
    const q = search.toLowerCase()
    return conversations.filter((c) => c.title.toLowerCase().includes(q))
  }, [conversations, search])

  const groups = useMemo(() => groupByDate(filtered), [filtered])

  return (
    <div className="flex h-screen w-[240px] flex-shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand + New Chat */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="gradient-text text-lg font-bold tracking-tight select-none">HexDesk</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-hex-cyan hover:bg-hex-glow"
                onClick={addConversation}
              >
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">新建对话</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-md bg-sidebar-accent/40 px-2.5 py-1.5 text-sm transition-colors focus-within:bg-sidebar-accent/60">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索对话..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-sidebar-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1 px-2">
        <div className="flex flex-col gap-0.5">
          {groups.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              {search ? "无匹配对话" : "暂无对话"}
            </div>
          )}
          {groups.map((group) => (
            <div key={group.label}>
              <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {group.label}
              </div>
              {group.items.map((conv) => {
                const isActive = conv.id === currentConversationId
                return (
                  <div
                    key={conv.id}
                    className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors ${
                      isActive
                        ? "border-l-2 border-l-hex-blue bg-sidebar-accent text-sidebar-accent-foreground"
                        : "border-l-2 border-l-transparent hover:bg-sidebar-accent/40 text-sidebar-foreground"
                    }`}
                    onClick={() => selectConversation(conv.id)}
                  >
                    <MessageSquare className={`size-3.5 flex-shrink-0 ${isActive ? "text-hex-cyan" : "opacity-40"}`} />
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
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-sidebar-border/50 px-3 py-2.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={toggleSidebar}>
                <PanelLeftClose className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">收起侧边栏</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="text-[10px] text-muted-foreground/60 select-none">v0.1.0</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">设置</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
