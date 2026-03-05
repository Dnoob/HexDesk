import { useState, type KeyboardEvent } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { SendHorizontal, Square } from "lucide-react"
import { useChatStore } from "@/stores/chat"

export function ChatInput() {
  const [content, setContent] = useState("")
  const sendMessage = useChatStore((s) => s.sendMessage)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const stopStreaming = useChatStore((s) => s.stopStreaming)

  const canSend = content.trim().length > 0 && !isStreaming

  function handleSend() {
    if (!canSend) return
    const text = content.trim()
    setContent("")
    sendMessage(text)
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
          disabled={isStreaming}
        />
        {isStreaming ? (
          <Button
            size="icon"
            variant="destructive"
            onClick={stopStreaming}
            className="absolute right-2 bottom-1.5 size-8"
          >
            <Square className="size-3" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!canSend}
            className="absolute right-2 bottom-1.5 size-8"
          >
            <SendHorizontal className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
