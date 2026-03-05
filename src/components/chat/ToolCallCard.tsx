import { useState } from "react"
import {
  FileText,
  Terminal,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import type { ToolCallInfo } from "@/types"

const toolNameMap: Record<string, string> = {
  read_file: "读取文件",
  write_file: "写入文件",
  list_directory: "列出目录",
  search_files: "搜索文件",
  execute_shell: "执行命令",
}

function getToolIcon(name: string) {
  if (name.includes("file") || name.includes("directory")) {
    return <FileText className="size-3.5" />
  }
  if (name.includes("shell") || name.includes("execute")) {
    return <Terminal className="size-3.5" />
  }
  if (name.includes("search")) {
    return <Search className="size-3.5" />
  }
  return <Terminal className="size-3.5" />
}

interface ToolCallCardProps {
  toolCall: ToolCallInfo
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)
  const displayName = toolNameMap[toolCall.name] ?? toolCall.name
  const isCalling = toolCall.status === "calling"
  const isDone = toolCall.status === "done"
  const isError = toolCall.status === "error"

  const borderColor = isCalling
    ? "border-l-blue-500"
    : isDone
      ? "border-l-green-500"
      : "border-l-red-500"

  let argsSummary = ""
  try {
    const parsed = JSON.parse(toolCall.arguments) as Record<string, unknown>
    const firstValue = Object.values(parsed)[0]
    argsSummary =
      typeof firstValue === "string" ? firstValue : JSON.stringify(firstValue)
  } catch {
    argsSummary = toolCall.arguments
  }

  return (
    <div
      className={`rounded-lg border-l-[3px] bg-muted/30 px-3 py-2 text-xs ${borderColor}`}
    >
      <div
        className={`flex items-center gap-2 select-none ${isDone ? "cursor-pointer" : ""}`}
        onClick={() => isDone && setExpanded((v) => !v)}
      >
        <span className="text-hex-cyan">{getToolIcon(toolCall.name)}</span>
        <span className="font-medium text-foreground">{displayName}</span>
        {argsSummary && (
          <span className="max-w-48 truncate text-muted-foreground">
            {argsSummary}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          {isCalling && (
            <>
              <Loader2 className="size-3.5 animate-spin text-blue-500" />
              <span className="text-blue-400">执行中...</span>
            </>
          )}
          {isDone && (
            <>
              <CheckCircle2 className="size-3.5 text-green-500" />
              <span className="text-green-400">已完成</span>
              {expanded ? (
                <ChevronDown className="size-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-3.5 text-muted-foreground" />
              )}
            </>
          )}
          {isError && (
            <>
              <AlertCircle className="size-3.5 text-red-500" />
              <span className="text-red-400">出错</span>
            </>
          )}
        </span>
      </div>
      {expanded && toolCall.result && (
        <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-background/50 p-2.5 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
          {toolCall.result}
        </pre>
      )}
    </div>
  )
}
