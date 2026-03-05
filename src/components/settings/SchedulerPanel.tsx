import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useSchedulerStore } from "@/stores/scheduler"
import { Trash2, Plus } from "lucide-react"

export default function SchedulerPanel() {
  const { tasks, loading, loadTasks, createTask, deleteTask, toggleTask } = useSchedulerStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState("")
  const [cronExpression, setCronExpression] = useState("")
  const [prompt, setPrompt] = useState("")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const handleCreate = async () => {
    if (!name.trim() || !cronExpression.trim() || !prompt.trim()) {
      setError("所有字段均为必填")
      return
    }
    setCreating(true)
    setError("")
    try {
      await createTask(name.trim(), cronExpression.trim(), prompt.trim())
      setDialogOpen(false)
      setName("")
      setCronExpression("")
      setPrompt("")
    } catch (e) {
      setError(String(e))
    } finally {
      setCreating(false)
    }
  }

  const formatNextRun = (ts: number | null): string => {
    if (ts === null) return "-"
    return new Date(ts).toLocaleString()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          配置定时自动执行的任务。
        </p>
        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="bg-hex-blue/80 hover:bg-hex-blue text-white"
        >
          <Plus className="mr-1 h-4 w-4" />
          添加任务
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">加载中...</p>}

      {!loading && tasks.length === 0 && (
        <p className="text-sm text-muted-foreground/60 py-8 text-center">
          暂无定时任务
        </p>
      )}

      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between rounded-xl border border-hex-blue/20 p-3 transition-colors hover:border-hex-cyan/30 hover:bg-hex-blue/5"
          >
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{task.name}</span>
                <code className="text-xs text-hex-cyan/70 bg-hex-blue/10 px-1.5 py-0.5 rounded-md font-mono">
                  {task.cronExpression}
                </code>
              </div>
              <p className="text-xs text-muted-foreground truncate">{task.prompt}</p>
              <p className="text-xs text-muted-foreground/60">
                下次执行：{formatNextRun(task.nextRun)}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-2 shrink-0">
              <Switch
                checked={task.enabled}
                onCheckedChange={(checked) => toggleTask(task.id, checked)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive/70 hover:text-destructive"
                onClick={() => deleteTask(task.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px] border-hex-blue/30 bg-background/95 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="text-hex-cyan">添加定时任务</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-name" className="text-muted-foreground">名称</Label>
              <Input
                id="task-name"
                placeholder="如：每日报告"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-hex-blue/20 focus:border-hex-cyan/50"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-cron" className="text-muted-foreground">Cron 表达式</Label>
              <Input
                id="task-cron"
                placeholder="如：0 0 9 * * *（每天早上 9 点）"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                className="border-hex-blue/20 focus:border-hex-cyan/50"
              />
              <p className="text-xs text-muted-foreground/60">
                格式：秒 分 时 日 月 周（6 个字段）。
                示例："0 0 9 * * *"（每天 9 点）、"0 */30 * * * *"（每 30 分钟）
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-prompt" className="text-muted-foreground">提示词</Label>
              <Textarea
                id="task-prompt"
                placeholder="任务触发时 AI 应执行的操作..."
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="border-hex-blue/20 focus:border-hex-cyan/50 resize-none"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-hex-blue/30">
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="bg-hex-blue/80 hover:bg-hex-blue text-white"
            >
              {creating ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
