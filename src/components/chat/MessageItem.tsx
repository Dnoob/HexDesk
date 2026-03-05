import type { Message } from "@/types"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { User, Bot } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"

interface MessageItemProps {
  message: Message
}

function stripThinkTags(content: string): string {
  return content.replace(/<think>[\s\S]*?<\/think>\s*/g, "")
}

export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === "user"
  const displayContent = isUser ? message.content : stripThinkTags(message.content)

  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <Avatar className="mt-0.5">
        <AvatarFallback className={isUser ? "bg-primary text-primary-foreground" : "bg-muted"}>
          {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
        </AvatarFallback>
      </Avatar>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground whitespace-pre-wrap"
            : "bg-card border markdown-body"
        }`}
      >
        {isUser ? (
          <>
            {message.content}
            {message.images && message.images.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {message.images.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt={`attached ${i + 1}`}
                    className="max-w-48 rounded-lg"
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {displayContent}
          </ReactMarkdown>
        )}
      </div>
    </div>
  )
}
