import type { Message } from "@/types"
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

export function MessageItem({
  message,
  isLastAssistant,
  isStreaming,
}: MessageItemProps) {
  const isUser = message.role === "user"
  const strippedContent = isUser
    ? message.content
    : stripThinkTags(message.content)
  const planSteps = !isUser ? parsePlan(strippedContent) : null
  const displayContent = planSteps
    ? stripPlanJson(strippedContent)
    : strippedContent
  const showThinking =
    !isUser && isLastAssistant && isStreaming && !displayContent
  const showCursor =
    !isUser && isLastAssistant && isStreaming && !!displayContent

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground whitespace-pre-wrap">
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
        </div>
      </div>
    )
  }

  // Assistant message
  return (
    <div className="max-w-full text-sm">
      {showThinking ? (
        <div className="flex items-center gap-1.5 py-2">
          <span className="thinking-dot size-2 rounded-full bg-hex-cyan" />
          <span className="thinking-dot size-2 rounded-full bg-hex-cyan [animation-delay:0.2s]" />
          <span className="thinking-dot size-2 rounded-full bg-hex-cyan [animation-delay:0.4s]" />
        </div>
      ) : (
        <>
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {message.toolCalls.map((tc) => (
                <ToolCallCard key={tc.id} toolCall={tc} />
              ))}
            </div>
          )}
          {planSteps && <AgentPlanCard steps={planSteps} />}
          <div className="markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {displayContent}
            </ReactMarkdown>
          </div>
          {showCursor && <span className="typing-cursor">▎</span>}
        </>
      )}
    </div>
  )
}
