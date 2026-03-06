import { useState } from "react"
import { useSandboxStore } from "@/stores/sandbox"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { RotateCw, Trash2, ChevronDown, ChevronRight } from "lucide-react"

const statusLabels: Record<string, { text: string; color: string }> = {
  not_installed: { text: "未安装", color: "bg-muted-foreground/40" },
  downloading: { text: "下载中", color: "bg-yellow-500 animate-pulse" },
  installing: { text: "安装中", color: "bg-yellow-500 animate-pulse" },
  starting: { text: "启动中", color: "bg-yellow-500 animate-pulse" },
  ready: { text: "已就绪", color: "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" },
  error: { text: "出错", color: "bg-red-500" },
  disabled: { text: "已禁用", color: "bg-muted-foreground/40" },
}

export default function SandboxSection() {
  const { status, agentInfo, bootLog, error, restart, setEnabled, cleanWorkspace } = useSandboxStore()
  const [showLog, setShowLog] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [cleaning, setCleaning] = useState(false)

  const isEnabled = status !== "disabled"
  const statusInfo = statusLabels[status] ?? statusLabels.not_installed

  const handleToggle = async (checked: boolean) => {
    await setEnabled(checked)
  }

  const handleRestart = async () => {
    setRestarting(true)
    try {
      await restart()
    } finally {
      setRestarting(false)
    }
  }

  const handleClean = async () => {
    setCleaning(true)
    try {
      await cleanWorkspace()
    } finally {
      setCleaning(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 启用/禁用开关 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor="sandbox-toggle" className="text-sm">启用沙盒</Label>
          <span className={`inline-block size-2 rounded-full ${statusInfo.color}`} />
          <span className="text-xs text-muted-foreground">{statusInfo.text}</span>
        </div>
        <Switch
          id="sandbox-toggle"
          checked={isEnabled}
          onCheckedChange={handleToggle}
        />
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-500">
          {error}
        </div>
      )}

      {/* Agent 信息 */}
      {agentInfo && (
        <div className="rounded-lg border border-hex-blue/20 bg-hex-blue/5 px-3 py-2.5">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Agent</span>
              <div className="font-mono text-hex-cyan">v{agentInfo.version}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Python</span>
              <div className="font-mono text-hex-cyan">{agentInfo.python}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Node</span>
              <div className="font-mono text-hex-cyan">{agentInfo.node}</div>
            </div>
          </div>
        </div>
      )}

      {/* 启动日志 */}
      {bootLog.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowLog(!showLog)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showLog ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            启动日志 ({bootLog.length} 行)
          </button>
          {showLog && (
            <pre className="mt-2 max-h-[200px] overflow-auto rounded-lg border border-hex-blue/20 bg-black/50 p-3 text-[11px] leading-relaxed text-muted-foreground font-mono">
              {bootLog.slice(-50).join("\n")}
            </pre>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="border-hex-blue/30 text-xs"
          disabled={restarting || !isEnabled}
          onClick={handleRestart}
        >
          <RotateCw className={`size-3 mr-1 ${restarting ? "animate-spin" : ""}`} />
          重启沙盒
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-hex-blue/30 text-xs"
          disabled={cleaning || status !== "ready"}
          onClick={handleClean}
        >
          <Trash2 className="size-3 mr-1" />
          清理工作空间
        </Button>
      </div>
    </div>
  )
}
