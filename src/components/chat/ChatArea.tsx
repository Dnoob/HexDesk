import { Bot, PanelLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useChatStore } from "@/stores/chat"
import { useUIStore } from "@/stores/ui"
import { MessageList } from "./MessageList"
import { ChatInput } from "./ChatInput"

const quickPrompts = [
  "帮我写一封工作邮件",
  "解释一段代码的作用",
  "总结一篇文章的要点",
  "翻译以下内容为英语",
]

function WelcomePage() {
  const addConversation = useChatStore((s) => s.addConversation)
  const sendMessage = useChatStore((s) => s.sendMessage)

  function handleQuickPrompt(prompt: string) {
    addConversation()
    sendMessage(prompt)
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <Bot className="size-16 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">HexDesk</h1>
      <p className="text-muted-foreground">Your AI Desktop Assistant</p>
      <Button onClick={addConversation} className="mt-4">
        Start a conversation
      </Button>
      <div className="mt-2 grid grid-cols-2 gap-2 max-w-md">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => handleQuickPrompt(prompt)}
            className="rounded-lg border px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors text-left"
          >
            {prompt}
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
    <div className="flex flex-1 flex-col h-screen">
      {/* Header */}
      <div className="flex h-12 items-center gap-2 border-b px-4">
        <Button variant="ghost" size="icon-sm" onClick={toggleSidebar}>
          <PanelLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium">
          {currentConversation?.title ?? "HexDesk"}
        </span>
      </div>

      {/* Content */}
      {currentConversationId ? (
        <>
          <MessageList />
          <ChatInput />
        </>
      ) : (
        <WelcomePage />
      )}
    </div>
  )
}
