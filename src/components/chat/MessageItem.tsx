import type { Message } from "@/types"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { User, Bot } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import { ToolCallCard } from "./ToolCallCard"
import { AgentPlanCard, parsePlan, stripPlanJson } from "./AgentPlanCard"

interface MessageItemProps {
  message: Message
  isLastAssistant?: boolean
  isStreaming?: boolean
}

function stripThinkTags(content: string): string {
  // Strip complete <think>...</think> blocks
  let result = content.replace(/<think>[\s\S]*?<\/think>\s*/g, "")
  // Strip incomplete <think>... (still streaming, no closing tag yet)
  result = result.replace(/<think>[\s\S]*$/g, "")
  return result
}

export function MessageItem({ message, isLastAssistant, isStreaming }: MessageItemProps) {
  const isUser = message.role === "user"
  const strippedContent = isUser ? message.content : stripThinkTags(message.content)
  const planSteps = !isUser ? parsePlan(strippedContent) : null
  const displayContent = planSteps ? stripPlanJson(strippedContent) : strippedContent
  const showThinking = !isUser && isLastAssistant && isStreaming && !displayContent
  const showCursor = !isUser && isLastAssistant && isStreaming && !!displayContent

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
        ) : showThinking ? (
          <span className="text-muted-foreground">思考中...</span>
        ) : (
          <>
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="mb-2 space-y-1.5">
                {message.toolCalls.map((tc) => (
                  <ToolCallCard key={tc.id} toolCall={tc} />
                ))}
              </div>
            )}
            {planSteps && <AgentPlanCard steps={planSteps} />}
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {displayContent}
            </ReactMarkdown>
            {showCursor && <span className="typing-cursor">▎</span>}
          </>
        )}
      </div>
    </div>
  )
}
