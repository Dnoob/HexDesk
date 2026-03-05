import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
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
  const { provider, apiKey, model, baseUrl, maxTokens, temperature, updateSettings } = useSettingsStore()

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
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general">
          <TabsList className="w-full">
            <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
            <TabsTrigger value="scheduler" className="flex-1">Scheduled Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="provider">Provider</Label>
                <Select value={provider} onValueChange={handleProviderChange}>
                  <SelectTrigger id="provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minimax">MiniMax</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="deepseek">DeepSeek</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your API key"
                  value={apiKey}
                  onChange={(e) => updateSettings({ apiKey: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={model}
                  onChange={(e) => updateSettings({ model: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  value={baseUrl}
                  onChange={(e) => updateSettings({ baseUrl: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="maxTokens">Max Tokens</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  min={1}
                  max={65536}
                  value={maxTokens}
                  onChange={(e) => updateSettings({ maxTokens: Number(e.target.value) })}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Temperature: {temperature.toFixed(1)}</Label>
                <Slider
                  min={0}
                  max={2}
                  step={0.1}
                  value={[temperature]}
                  onValueChange={([value]) => updateSettings({ temperature: value })}
                />
              </div>

              <Separator />

              <McpSection />
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
      <Label className="text-base font-semibold">MCP Servers</Label>

      {servers.map((server) => {
        const isConnected = Boolean(connectedTools[server.name])
        const toolCount = connectedTools[server.name]?.length ?? 0
        return (
          <div key={server.name} className="flex items-center gap-2 rounded border p-2 text-sm">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{server.name}</div>
              <div className="text-muted-foreground truncate text-xs">
                {server.command} {server.args.join(" ")}
              </div>
              {isConnected && (
                <div className="text-xs text-green-600">{toolCount} tools</div>
              )}
            </div>
            <Button
              size="sm"
              variant={isConnected ? "outline" : "default"}
              disabled={connecting === server.name}
              onClick={() => isConnected ? handleDisconnect(server.name) : handleConnect(server.name)}
            >
              {connecting === server.name ? "..." : isConnected ? "Disconnect" : "Connect"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => removeServer(server.name)}
            >
              X
            </Button>
          </div>
        )
      })}

      {error && <div className="text-sm text-red-500">{error}</div>}

      <div className="flex flex-col gap-2 rounded border p-2">
        <Input
          placeholder="Server name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Command (e.g. npx)"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
        />
        <Input
          placeholder="Args (space-separated)"
          value={args}
          onChange={(e) => setArgs(e.target.value)}
        />
        <Button size="sm" onClick={handleAdd} disabled={!name.trim() || !command.trim()}>
          Add Server
        </Button>
      </div>
    </div>
  )
}
