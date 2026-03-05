import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useChatStore } from "@/stores/chat"
import { MessageItem } from "./MessageItem"

export function MessageList() {
  const messages = useChatStore((s) => s.messages)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  if (messages.length === 0) return null

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
        {messages.map((msg, index) => {
          const isLastAssistant =
            msg.role === "assistant" && index === messages.length - 1
          return (
            <div
              key={msg.id}
              className={
                isLastAssistant && isStreaming ? "" : "animate-message-in"
              }
            >
              <MessageItem
                message={msg}
                isLastAssistant={isLastAssistant}
                isStreaming={isStreaming}
              />
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
