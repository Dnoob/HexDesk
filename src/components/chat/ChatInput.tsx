import { useState, useRef, type KeyboardEvent, type ClipboardEvent } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { SendHorizontal, Square, ImagePlus, X, Zap, Bot, FolderOpen } from "lucide-react"
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

  const canSend = (content.trim().length > 0 || images.length > 0) && !isStreaming

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

  return (
    <div className="border-t p-4">
      {/* Folder selector tag */}
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSelectFolder}
          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <FolderOpen className="size-3.5" />
          {workingDirectory ? (
            <span className="max-w-[300px] truncate" title={workingDirectory}>
              {workingDirectory}
            </span>
          ) : (
            <span>选择工作目录</span>
          )}
        </button>
        {workingDirectory && (
          <button
            type="button"
            onClick={() => updateSettings({ workingDirectory: "" })}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {images.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative group">
              <img
                src={img}
                alt={`preview ${i + 1}`}
                className="size-16 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="relative flex items-end gap-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming}
          className="size-8 shrink-0"
        >
          <ImagePlus className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setSkillsOpen(true)}
          disabled={isStreaming}
          className="size-8 shrink-0"
        >
          <Zap className="size-4" />
        </Button>
        <Button
          size="icon"
          variant={isAgentMode ? "default" : "ghost"}
          onClick={toggleAgentMode}
          disabled={isStreaming}
          className="size-8 shrink-0"
          title="Agent mode"
        >
          <Bot className="size-4" />
        </Button>
        <SkillsPanel
          open={skillsOpen}
          onOpenChange={setSkillsOpen}
          onSend={(message) => {
            sendMessage(message)
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={isAgentMode ? "Describe your task, AI will plan and execute..." : "Send a message..."}
          className="min-h-10 max-h-40 resize-none pr-12"
          rows={1}
          disabled={isStreaming}
        />
        {isStreaming ? (
          <Button
            size="icon"
            variant="destructive"
            onClick={stopStreaming}
            className="absolute right-2 bottom-1.5 size-8"
          >
            <Square className="size-3" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!canSend}
            className="absolute right-2 bottom-1.5 size-8"
          >
            <SendHorizontal className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
