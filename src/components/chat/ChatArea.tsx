import { Mail, Code, FileText, Languages, PanelLeft, Hexagon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useChatStore } from "@/stores/chat"
import { useUIStore } from "@/stores/ui"
import { MessageList } from "./MessageList"
import { ChatInput } from "./ChatInput"
import { SandboxBanner } from "./SandboxBanner"

const suggestions = [
  {
    icon: Mail,
    title: "撰写邮件",
    description: "帮我写一封专业的工作邮件",
  },
  {
    icon: Code,
    title: "解释代码",
    description: "分析并解释一段代码的作用",
  },
  {
    icon: FileText,
    title: "总结文档",
    description: "帮我总结一篇文章的关键要点",
  },
  {
    icon: Languages,
    title: "翻译内容",
    description: "将以下内容翻译为英语",
  },
]

function WelcomePage() {
  const addConversation = useChatStore((s) => s.addConversation)
  const sendMessage = useChatStore((s) => s.sendMessage)

  function handleSuggestion(description: string) {
    addConversation()
    sendMessage(description)
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <div className="relative mb-6 animate-fade-up">
        <div className="absolute inset-0 animate-pulse rounded-full bg-hex-cyan/20 blur-3xl" />
        <Hexagon className="relative size-20 text-hex-cyan fill-hex-cyan/10 stroke-[1.5]" />
      </div>

      <div className="text-center">
        <h1 className="gradient-text animate-fade-up text-5xl font-bold tracking-tight [animation-delay:0.1s]">
          HexDesk
        </h1>
        <p className="mt-3 animate-fade-up text-lg text-muted-foreground [animation-delay:0.2s]">
          你的智能桌面助手
        </p>
      </div>

      <div className="mt-6 grid w-full max-w-lg grid-cols-2 gap-3">
        {suggestions.map((item, index) => (
          <button
            key={item.title}
            type="button"
            onClick={() => handleSuggestion(item.description)}
            className="animate-fade-up flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:bg-accent hover:shadow-lg hover:shadow-hex-glow hover:border-hex-cyan/20"
            style={{ animationDelay: `${0.3 + index * 0.08}s` }}
          >
            <item.icon className="mt-0.5 size-5 shrink-0 text-hex-cyan" />
            <div className="min-w-0">
              <div className="font-semibold text-sm">{item.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {item.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ChatArea() {
  const currentConversationId = useChatStore((s) => s.currentConversationId)
  const conversations = useChatStore((s) => s.conversations)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId
  )

  return (
    <div className="relative flex flex-1 flex-col h-screen">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[400px] w-[400px] rounded-full bg-hex-cyan/[0.03] blur-[100px]" />
        <div className="absolute -right-[10%] -bottom-[10%] h-[400px] w-[400px] rounded-full bg-hex-blue/[0.03] blur-[100px]" />
      </div>

      {/* Header */}
      <div className="flex h-12 items-center border-b px-4">
        <Button variant="ghost" size="icon-sm" onClick={toggleSidebar}>
          <PanelLeft className="size-4" />
        </Button>
        <span className="ml-2 text-sm font-medium truncate">
          {currentConversation?.title ?? "HexDesk"}
        </span>
      </div>

      {/* Sandbox Banner */}
      <SandboxBanner />

      {/* Content */}
      {currentConversationId ? (
        <>
          <MessageList />
          <ChatInput />
        </>
      ) : (
        <>
          <WelcomePage />
          <ChatInput />
        </>
      )}
    </div>
  )
}
