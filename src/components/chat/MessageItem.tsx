import { useState } from "react"
import type { Message } from "@/types"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import { Hexagon, Copy, Check } from "lucide-react"
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      <span>{copied ? "已复制" : "复制"}</span>
    </button>
  )
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
    <div className="flex gap-3 max-w-full text-sm">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-hex-cyan/10 text-hex-cyan">
        <Hexagon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
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
                components={{
                  pre({ children }) {
                    return <>{children}</>
                  },
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "")
                    const codeText = String(children).replace(/\n$/, "")
                    if (match) {
                      return (
                        <div className="code-block-wrapper my-3 overflow-hidden rounded-lg border border-border/50 bg-muted/20">
                          <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-3 py-1.5">
                            <span className="text-xs text-muted-foreground">
                              {match[1]}
                            </span>
                            <CopyButton text={codeText} />
                          </div>
                          <pre className="overflow-x-auto p-3">
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </pre>
                        </div>
                      )
                    }
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    )
                  },
                }}
              >
                {displayContent}
              </ReactMarkdown>
            </div>
            {showCursor && <span className="typing-cursor">▎</span>}
          </>
        )}
      </div>
    </div>
  )
}
