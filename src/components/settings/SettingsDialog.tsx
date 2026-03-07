import { useState } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import {
  Palette,
  Bot,
  Wrench,
  Sun,
  Moon,
  Monitor,
  Container,
} from "lucide-react"
import { useSettingsStore } from "@/stores/settings"
import { useUIStore } from "@/stores/ui"
import { useMcpStore } from "@/stores/mcp"
import SchedulerPanel from "./SchedulerPanel"
import SandboxSection from "./SandboxSection"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Section = "appearance" | "model" | "sandbox" | "advanced"

const navItems: { key: Section; label: string; icon: typeof Palette }[] = [
  { key: "appearance", label: "外观", icon: Palette },
  { key: "model", label: "模型", icon: Bot },
  { key: "sandbox", label: "沙盒", icon: Container },
  { key: "advanced", label: "高级", icon: Wrench },
]

const providerPresets: Record<string, { baseUrl: string; model: string }> = {
  minimax: { baseUrl: "https://api.minimaxi.com/v1", model: "MiniMax-M2.5" },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o" },
  deepseek: { baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
}

const themeOptions = [
  { value: "dark" as const, label: "深色", icon: Moon, desc: "深色背景，护眼" },
  { value: "light" as const, label: "浅色", icon: Sun, desc: "浅色背景，清爽" },
  { value: "system" as const, label: "跟随系统", icon: Monitor, desc: "自动适配" },
]

export default function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [section, setSection] = useState<Section>("appearance")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] border-hex-blue/30 bg-background/95 backdrop-blur-sm p-0 gap-0 overflow-hidden">
        <div className="flex h-[520px]">
          {/* 左侧导航 */}
          <nav className="flex w-[180px] shrink-0 flex-col border-r border-hex-blue/15 bg-sidebar/50 px-3 py-5">
            <h2 className="mb-4 px-2 text-lg font-bold text-hex-cyan">设置</h2>
            <div className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = section === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSection(item.key)}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-hex-blue/15 text-hex-cyan font-medium"
                        : "text-muted-foreground hover:bg-hex-blue/8 hover:text-foreground"
                    }`}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </nav>

          {/* 右侧内容 */}
          <div className="flex-1 overflow-y-auto p-6">
            {section === "appearance" && <AppearanceSection />}
            {section === "model" && <ModelSection />}
            {section === "sandbox" && <SandboxSettingsSection />}
            {section === "advanced" && <AdvancedSection />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ── 外观 ── */
function AppearanceSection() {
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle title="主题" />
      <div className="grid grid-cols-3 gap-3">
        {themeOptions.map((opt) => {
          const isActive = theme === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              className={`relative flex flex-col items-center gap-2.5 rounded-xl border-2 p-4 transition-all ${
                isActive
                  ? "border-hex-cyan bg-hex-blue/15 shadow-[0_0_16px_rgba(0,200,255,0.1)]"
                  : "border-hex-blue/20 hover:border-hex-blue/40 hover:bg-hex-blue/5"
              }`}
            >
              <div
                className={`flex size-10 items-center justify-center rounded-full ${
                  isActive
                    ? "bg-hex-cyan/20 text-hex-cyan"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <opt.icon className="size-5" />
              </div>
              <span
                className={`text-sm font-medium ${isActive ? "text-hex-cyan" : "text-foreground"}`}
              >
                {opt.label}
              </span>
              <span className="text-[11px] text-muted-foreground text-center leading-tight">
                {opt.desc}
              </span>
              {isActive && (
                <div className="absolute top-2 right-2 size-2 rounded-full bg-hex-cyan shadow-[0_0_6px_rgba(0,200,255,0.6)]" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── 模型 ── */
function ModelSection() {
  const {
    provider,
    apiKey,
    model,
    baseUrl,
    maxTokens,
    temperature,
    updateSettings,
  } = useSettingsStore()

  const handleProviderChange = (value: string) => {
    const preset = providerPresets[value]
    if (preset) {
      updateSettings({ provider: value, baseUrl: preset.baseUrl, model: preset.model })
    } else {
      updateSettings({ provider: value })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 模型配置 */}
      <SectionTitle title="模型配置" />

      <div className="flex flex-col gap-2">
        <Label htmlFor="provider" className="text-muted-foreground">服务商</Label>
        <Select value={provider} onValueChange={handleProviderChange}>
          <SelectTrigger id="provider" className="border-hex-blue/20 focus:border-hex-cyan/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minimax">MiniMax</SelectItem>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="deepseek">DeepSeek</SelectItem>
            <SelectItem value="custom">自定义</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="apiKey" className="text-muted-foreground">API 密钥</Label>
        <Input
          id="apiKey"
          type="password"
          placeholder="输入你的 API 密钥"
          value={apiKey}
          onChange={(e) => updateSettings({ apiKey: e.target.value })}
          className="border-hex-blue/20 focus:border-hex-cyan/50"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="model" className="text-muted-foreground">模型</Label>
          <Input
            id="model"
            value={model}
            onChange={(e) => updateSettings({ model: e.target.value })}
            className="border-hex-blue/20 focus:border-hex-cyan/50"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="baseUrl" className="text-muted-foreground">接口地址</Label>
          <Input
            id="baseUrl"
            value={baseUrl}
            onChange={(e) => updateSettings({ baseUrl: e.target.value })}
            className="border-hex-blue/20 focus:border-hex-cyan/50"
          />
        </div>
      </div>

      {/* 生成参数 */}
      <SectionTitle title="生成参数" className="mt-2" />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="maxTokens" className="text-muted-foreground">最大令牌数</Label>
          <Input
            id="maxTokens"
            type="number"
            min={1}
            max={65536}
            value={maxTokens}
            onChange={(e) => updateSettings({ maxTokens: Number(e.target.value) })}
            className="border-hex-blue/20 focus:border-hex-cyan/50"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-muted-foreground">
            随机性：<span className="text-hex-cyan font-mono">{temperature.toFixed(1)}</span>
          </Label>
          <Slider
            min={0}
            max={2}
            step={0.1}
            value={[temperature]}
            onValueChange={([value]) => updateSettings({ temperature: value })}
            className="mt-2"
          />
        </div>
      </div>

    </div>
  )
}

/* ── 沙盒 ── */
function SandboxSettingsSection() {
  return (
    <div className="flex flex-col gap-5">
      <SectionTitle title="虚拟机沙盒" />
      <SandboxSection />
    </div>
  )
}

/* ── 高级 ── */
function AdvancedSection() {
  return (
    <div className="flex flex-col gap-5">
      <SectionTitle title="MCP 服务器" />
      <McpSection />

      <SectionTitle title="定时任务" className="mt-2" />
      <SchedulerPanel />
    </div>
  )
}

/* ── 区块标题 ── */
function SectionTitle({ title, className }: { title: string; className?: string }) {
  return (
    <div className={className}>
      <h3 className="text-sm font-semibold text-hex-cyan tracking-wide">{title}</h3>
      <Separator className="mt-2 bg-hex-blue/20" />
    </div>
  )
}

/* ── MCP ── */
function StatusDot({ status }: { status?: string }) {
  const isConnected = status === "connected"
  const isReconnecting = status === "reconnecting"
  const isError = status === "error"

  return (
    <span
      className={`inline-block h-2 w-2 rounded-full shrink-0 ${
        isConnected
          ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]"
          : isReconnecting
            ? "bg-yellow-500 animate-pulse shadow-[0_0_6px_rgba(234,179,8,0.5)]"
            : isError
              ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]"
              : "bg-muted-foreground/40"
      }`}
    />
  )
}

function McpSection() {
  const { servers, connectedTools, serverStatus, addServer, removeServer, connect, disconnect } = useMcpStore()
  const [name, setName] = useState("")
  const [command, setCommand] = useState("")
  const [args, setArgs] = useState("")
  const [connecting, setConnecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = () => {
    if (!name.trim() || !command.trim()) return
    addServer({
      name: name.trim(),
      command: command.trim(),
      args: args.trim() ? args.trim().split(/\s+/) : [],
    })
    setName("")
    setCommand("")
    setArgs("")
  }

  const handleConnect = async (serverName: string) => {
    setConnecting(serverName)
    setError(null)
    try {
      await connect(serverName)
    } catch (e) {
      setError(String(e))
    } finally {
      setConnecting(null)
    }
  }

  const handleDisconnect = async (serverName: string) => {
    setError(null)
    try {
      await disconnect(serverName)
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {servers.map((server) => {
        const status = serverStatus[server.name]
        const isConnected = status === "connected" || Boolean(connectedTools[server.name])
        const toolCount = connectedTools[server.name]?.length ?? 0
        return (
          <div
            key={server.name}
            className="flex items-center gap-3 rounded-xl border border-hex-blue/20 p-3 text-sm transition-colors hover:border-hex-cyan/30 hover:bg-hex-blue/5"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <StatusDot status={status} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{server.name}</div>
                <div className="text-muted-foreground truncate text-xs">
                  {server.command} {server.args.join(" ")}
                </div>
                {isConnected && (
                  <div className="text-xs text-hex-cyan/70">{toolCount} 个工具</div>
                )}
                {status === "error" && (
                  <div className="text-xs text-red-500">连接异常</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant={isConnected ? "outline" : "default"}
                disabled={connecting === server.name || status === "reconnecting"}
                onClick={() =>
                  isConnected ? handleDisconnect(server.name) : handleConnect(server.name)
                }
                className={`text-xs ${!isConnected ? "bg-hex-blue/80 hover:bg-hex-blue text-white" : "border-hex-blue/30"}`}
              >
                {connecting === server.name || status === "reconnecting"
                  ? "..."
                  : isConnected
                    ? "断开"
                    : "连接"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-destructive/70 hover:text-destructive"
                onClick={() => removeServer(server.name)}
              >
                删除
              </Button>
            </div>
          </div>
        )
      })}

      {error && <div className="text-sm text-red-500">{error}</div>}

      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-hex-blue/20 p-3">
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="服务器名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-hex-blue/20 focus:border-hex-cyan/50 text-sm"
          />
          <Input
            placeholder="命令（如 npx）"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="border-hex-blue/20 focus:border-hex-cyan/50 text-sm"
          />
        </div>
        <Input
          placeholder="参数（空格分隔）"
          value={args}
          onChange={(e) => setArgs(e.target.value)}
          className="border-hex-blue/20 focus:border-hex-cyan/50 text-sm"
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!name.trim() || !command.trim()}
          className="bg-hex-blue/80 hover:bg-hex-blue text-white"
        >
          添加服务器
        </Button>
      </div>
    </div>
  )
}
