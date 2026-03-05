import { useState } from "react"
import { FileText, Terminal, Search, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronRight } from "lucide-react"
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

  let argsSummary = ""
  try {
    const parsed = JSON.parse(toolCall.arguments) as Record<string, unknown>
    const firstValue = Object.values(parsed)[0]
    argsSummary = typeof firstValue === "string" ? firstValue : JSON.stringify(firstValue)
  } catch {
    argsSummary = toolCall.arguments
  }

  return (
    <div className="rounded-md border bg-muted/10 px-3 py-2 text-xs">
      <div
        className="flex items-center gap-2 cursor-pointer select-none"
        onClick={() => isDone && setExpanded((v) => !v)}
      >
        <span className="text-muted-foreground">{getToolIcon(toolCall.name)}</span>
        <span className="font-medium">{displayName}</span>
        {argsSummary && (
          <span className="truncate max-w-48 text-muted-foreground">{argsSummary}</span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {isCalling && (
            <>
              <Loader2 className="size-3.5 animate-spin text-blue-500" />
              <span className="text-muted-foreground">执行中...</span>
            </>
          )}
          {isDone && (
            <>
              <CheckCircle2 className="size-3.5 text-green-500" />
              <span className="text-muted-foreground">完成</span>
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
              <span className="text-red-500">错误</span>
            </>
          )}
        </span>
      </div>
      {expanded && toolCall.result && (
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">
          {toolCall.result}
        </pre>
      )}
    </div>
  )
}
