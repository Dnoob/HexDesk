import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSettingsStore } from "@/stores/settings"
import { useMcpStore } from "@/stores/mcp"
import SchedulerPanel from "./SchedulerPanel"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const providerPresets: Record<string, { baseUrl: string; model: string }> = {
  minimax: { baseUrl: "https://api.minimaxi.com/v1", model: "MiniMax-M2.5" },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o" },
  deepseek: { baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
}

export default function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { provider, apiKey, model, baseUrl, maxTokens, temperature, systemPrompt, updateSettings } = useSettingsStore()

  const handleProviderChange = (value: string) => {
    const preset = providerPresets[value]
    if (preset) {
      updateSettings({ provider: value, baseUrl: preset.baseUrl, model: preset.model })
    } else {
      updateSettings({ provider: value })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] border-hex-blue/30 bg-background/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-hex-cyan">
            设置
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general">
          <TabsList className="w-full bg-hex-blue/10 border border-hex-blue/20">
            <TabsTrigger
              value="general"
              className="flex-1 data-[state=active]:bg-hex-blue/20 data-[state=active]:text-hex-cyan"
            >
              通用
            </TabsTrigger>
            <TabsTrigger
              value="scheduler"
              className="flex-1 data-[state=active]:bg-hex-blue/20 data-[state=active]:text-hex-cyan"
            >
              定时任务
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <div className="flex flex-col gap-5 py-2 max-h-[60vh] overflow-y-auto pr-1">
              {/* 模型配置 */}
              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-hex-cyan tracking-wide">
                  模型配置
                </h3>
                <Separator className="bg-hex-blue/20" />

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
              </section>

              {/* 生成参数 */}
              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-hex-cyan tracking-wide">
                  生成参数
                </h3>
                <Separator className="bg-hex-blue/20" />

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
              </section>

              {/* 系统提示词 */}
              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-hex-cyan tracking-wide">
                  系统提示词
                </h3>
                <Separator className="bg-hex-blue/20" />

                <Textarea
                  id="systemPrompt"
                  rows={4}
                  value={systemPrompt}
                  onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
                  placeholder="设定 AI 的行为和风格..."
                  className="border-hex-blue/20 focus:border-hex-cyan/50 resize-none"
                />
              </section>

              {/* MCP 服务器 */}
              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-hex-cyan tracking-wide">
                  MCP 服务器
                </h3>
                <Separator className="bg-hex-blue/20" />
                <McpSection />
              </section>
            </div>
          </TabsContent>

          <TabsContent value="scheduler">
            <div className="py-2">
              <SchedulerPanel />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function McpSection() {
  const { servers, connectedTools, addServer, removeServer, connect, disconnect } = useMcpStore()
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
        const isConnected = Boolean(connectedTools[server.name])
        const toolCount = connectedTools[server.name]?.length ?? 0
        return (
          <div
            key={server.name}
            className="flex items-center gap-3 rounded-xl border border-hex-blue/20 p-3 text-sm transition-colors hover:border-hex-cyan/30 hover:bg-hex-blue/5"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span
                className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                  isConnected ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-muted-foreground/40"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{server.name}</div>
                <div className="text-muted-foreground truncate text-xs">
                  {server.command} {server.args.join(" ")}
                </div>
                {isConnected && (
                  <div className="text-xs text-hex-cyan/70">{toolCount} 个工具</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant={isConnected ? "outline" : "default"}
                disabled={connecting === server.name}
                onClick={() => isConnected ? handleDisconnect(server.name) : handleConnect(server.name)}
                className={`text-xs ${!isConnected ? "bg-hex-blue/80 hover:bg-hex-blue text-white" : "border-hex-blue/30"}`}
              >
                {connecting === server.name ? "..." : isConnected ? "断开" : "连接"}
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
