import { useState, type KeyboardEvent } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { SendHorizontal } from "lucide-react"
import { useChatStore } from "@/stores/chat"

export function ChatInput() {
  const [content, setContent] = useState("")
  const addMessage = useChatStore((s) => s.addMessage)
  const addConversation = useChatStore((s) => s.addConversation)
  const currentConversationId = useChatStore((s) => s.currentConversationId)

  const canSend = content.trim().length > 0

  function handleSend() {
    if (!canSend) return
    if (!currentConversationId) {
      addConversation()
    }
    addMessage("user", content.trim())
    setContent("")
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t p-4">
      <div className="relative flex items-end gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          className="min-h-10 max-h-40 resize-none pr-12"
          rows={1}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!canSend}
          className="absolute right-2 bottom-1.5 size-8"
        >
          <SendHorizontal className="size-4" />
        </Button>
      </div>
    </div>
  )
}
