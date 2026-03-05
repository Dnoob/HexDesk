import { useState, useRef, type KeyboardEvent, type ClipboardEvent } from "react"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowUp,
  Square,
  Paperclip,
  X,
  Zap,
  Bot,
  FolderOpen,
} from "lucide-react"
import { useChatStore } from "@/stores/chat"
import { useAgentStore } from "@/stores/agent"
import { useSettingsStore } from "@/stores/settings"
import { SkillsPanel } from "./SkillsPanel"
import { open } from "@tauri-apps/plugin-dialog"

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function ChatInput() {
  const [content, setContent] = useState("")
  const [images, setImages] = useState<string[]>([])
  const [skillsOpen, setSkillsOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const stopStreaming = useChatStore((s) => s.stopStreaming)
  const isAgentMode = useAgentStore((s) => s.isAgentMode)
  const toggleAgentMode = useAgentStore((s) => s.toggleAgentMode)
  const workingDirectory = useSettingsStore((s) => s.workingDirectory)
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  async function handleSelectFolder() {
    const selected = await open({ directory: true, multiple: false })
    if (selected) {
      updateSettings({ workingDirectory: selected as string })
    }
  }

  const canSend =
    (content.trim().length > 0 || images.length > 0) && !isStreaming

  function handleSend() {
    if (!canSend) return
    const text = content.trim()
    const imgs = [...images]
    setContent("")
    setImages([])
    sendMessage(text, imgs.length > 0 ? imgs : undefined)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData.items
    const imageFiles: File[] = []
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile()
        if (file) imageFiles.push(file)
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault()
      const dataUrls = await Promise.all(imageFiles.map(readFileAsDataUrl))
      setImages((prev) => [...prev, ...dataUrls])
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    const dataUrls = await Promise.all(
      Array.from(files).map(readFileAsDataUrl)
    )
    setImages((prev) => [...prev, ...dataUrls])
    e.target.value = ""
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const folderName = workingDirectory
    ? workingDirectory.split(/[\\/]/).filter(Boolean).pop() ?? workingDirectory
    : ""

  return (
    <div className="mx-auto mt-auto w-full max-w-3xl shrink-0 px-4 pb-4">
      <div className={`flex flex-col rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl shadow-xl ring-1 ring-white/[0.03] transition-all duration-200 focus-within:border-hex-cyan/30 focus-within:ring-hex-cyan/10 focus-within:shadow-[0_0_15px_rgba(0,200,255,0.06)] ${isAgentMode ? "border-hex-cyan/20" : ""}`}>
        {/* Image previews */}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {images.map((img, i) => (
              <div key={i} className="group relative">
                <img
                  src={img}
                  alt={`preview ${i + 1}`}
                  className="size-16 rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea */}
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="有什么可以帮你的？"
          className="min-h-[44px] max-h-36 resize-none border-0 bg-transparent px-4 pt-3 pb-1 text-sm focus-visible:ring-0"
          rows={1}
          disabled={isStreaming}
        />

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between px-3 pb-2.5">
          {/* Left tools */}
          <div className="flex items-center gap-1">
            {workingDirectory ? (
              <button
                type="button"
                onClick={handleSelectFolder}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hex-blue/25 px-2.5 py-1 text-xs text-hex-cyan transition-colors hover:bg-hex-blue/10"
              >
                <FolderOpen className="size-3.5 text-hex-blue" />
                <span className="max-w-[180px] truncate">{folderName}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    updateSettings({ workingDirectory: "" })
                  }}
                  className="ml-0.5 rounded hover:text-foreground transition-colors"
                >
                  <X className="size-3" />
                </button>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSelectFolder}
                disabled={isStreaming}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground hover:bg-accent disabled:opacity-40"
                title="选择工作目录"
              >
                <FolderOpen className="size-[18px]" />
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground hover:bg-accent disabled:opacity-40"
              title="添加图片"
            >
              <Paperclip className="size-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => setSkillsOpen(true)}
              disabled={isStreaming}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground hover:bg-accent disabled:opacity-40"
              title="技能"
            >
              <Zap className="size-[18px]" />
            </button>
          </div>

          {/* Right: agent toggle + send */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleAgentMode}
              disabled={isStreaming}
              className={`flex size-8 items-center justify-center rounded-lg transition-all disabled:opacity-40 ${
                isAgentMode
                  ? "bg-hex-cyan/15 text-hex-cyan shadow-[0_0_8px_rgba(0,200,255,0.12)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
              title={isAgentMode ? "关闭 Agent 模式" : "开启 Agent 模式"}
            >
              <Bot className="size-[18px]" />
            </button>

            {isStreaming ? (
              <button
                type="button"
                onClick={stopStreaming}
                className="flex size-8 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90"
              >
                <Square className="size-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className="flex size-8 items-center justify-center rounded-full bg-foreground text-background transition-all disabled:opacity-25 enabled:shadow-[0_0_10px_rgba(0,200,255,0.15)] enabled:hover:shadow-[0_0_15px_rgba(0,200,255,0.25)]"
              >
                <ArrowUp className="size-4" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hidden */}
      <SkillsPanel
        open={skillsOpen}
        onOpenChange={setSkillsOpen}
        onSend={(message) => sendMessage(message)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
