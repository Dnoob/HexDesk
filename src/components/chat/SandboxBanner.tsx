import { useEffect, useState } from "react"
import { useSandboxStore } from "@/stores/sandbox"
import { Download, Loader2, CheckCircle2, AlertCircle, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SandboxBanner() {
  const { status, progress, error, restart } = useSandboxStore()
  const [visible, setVisible] = useState(true)

  // ready 状态 3 秒后自动消失
  useEffect(() => {
    if (status === "ready") {
      const timer = setTimeout(() => setVisible(false), 3000)
      return () => clearTimeout(timer)
    }
    setVisible(true)
  }, [status])

  // 不需要显示的状态
  if (status === "disabled" || status === "not_installed" || !visible) {
    return null
  }

  return (
    <div className="mx-4 mt-3 mb-1 animate-fade-up">
      {status === "downloading" && <DownloadingBanner progress={progress} />}
      {status === "installing" && <InstallingBanner />}
      {status === "starting" && <StartingBanner />}
      {status === "ready" && <ReadyBanner />}
      {status === "error" && <ErrorBanner error={error} onRestart={restart} />}
    </div>
  )
}

function DownloadingBanner({ progress }: { progress: { downloaded: number; total: number; speed: number; phase: string } | null }) {
  const downloaded = progress ? (progress.downloaded / 1024 / 1024).toFixed(0) : "0"
  const total = progress ? (progress.total / 1024 / 1024).toFixed(0) : "500"
  const percent = progress && progress.total > 0 ? Math.round((progress.downloaded / progress.total) * 100) : 0
  const speed = progress ? (progress.speed / 1024 / 1024).toFixed(1) : "0"

  return (
    <div className="rounded-xl border border-hex-blue/20 bg-card/80 backdrop-blur-sm p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <Download className="size-4 text-hex-cyan animate-pulse" />
        <span className="text-sm font-medium">正在安装执行环境（首次使用需要下载约 500MB）</span>
      </div>
      <div className="relative h-2 rounded-full bg-hex-blue/10 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-hex-blue to-hex-cyan transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{percent}% — {downloaded}MB / {total}MB</span>
        <span>{speed} MB/s</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        安装完成后，AI 将可以执行 Python、Node 等代码。当前仍可正常对话。
      </p>
    </div>
  )
}

function InstallingBanner() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-hex-blue/20 bg-card/80 backdrop-blur-sm px-4 py-3">
      <Loader2 className="size-4 text-hex-cyan animate-spin" />
      <span className="text-sm">正在安装执行环境...</span>
    </div>
  )
}

function StartingBanner() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-hex-blue/20 bg-card/80 backdrop-blur-sm px-4 py-3">
      <Loader2 className="size-4 text-hex-cyan animate-spin" />
      <span className="text-sm">正在启动沙盒...</span>
    </div>
  )
}

function ReadyBanner() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-green-500/20 bg-green-500/5 backdrop-blur-sm px-4 py-3">
      <CheckCircle2 className="size-4 text-green-500" />
      <span className="text-sm text-green-500 font-medium">执行环境已就绪</span>
    </div>
  )
}

function ErrorBanner({ error, onRestart }: { error: string | null; onRestart: () => void }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 backdrop-blur-sm px-4 py-3">
      <AlertCircle className="size-4 text-red-500 shrink-0" />
      <span className="text-sm text-red-500 flex-1 min-w-0 truncate">
        沙盒出错：{error ?? "未知错误"}
      </span>
      <Button
        size="sm"
        variant="ghost"
        className="shrink-0 text-xs text-red-500 hover:text-red-400"
        onClick={onRestart}
      >
        <RotateCw className="size-3 mr-1" />
        重启
      </Button>
    </div>
  )
}
