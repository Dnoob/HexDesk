import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { useSettingsStore } from "@/stores/settings"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const providerPresets: Record<string, { baseUrl: string; model: string }> = {
  minimax: { baseUrl: "https://api.minimax.chat/v1", model: "MiniMax-Text-01" },
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
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

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
        </div>
      </DialogContent>
    </Dialog>
  )
}
