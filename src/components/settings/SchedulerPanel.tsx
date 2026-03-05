import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
      setError("All fields are required")
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
          Configure tasks to run automatically on a schedule.
        </p>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add Task
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}

      {!loading && tasks.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No scheduled tasks yet.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{task.name}</span>
                <code className="text-xs text-muted-foreground bg-muted px-1 rounded">
                  {task.cronExpression}
                </code>
              </div>
              <p className="text-xs text-muted-foreground truncate">{task.prompt}</p>
              <p className="text-xs text-muted-foreground">
                Next run: {formatNextRun(task.nextRun)}
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
                className="h-8 w-8 text-destructive"
                onClick={() => deleteTask(task.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add Scheduled Task</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-name">Name</Label>
              <Input
                id="task-name"
                placeholder="e.g. Daily Report"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-cron">Cron Expression</Label>
              <Input
                id="task-cron"
                placeholder="e.g. 0 0 9 * * * (every day at 9am)"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Format: sec min hour day month weekday (6 fields).
                Examples: "0 0 9 * * *" (daily 9am), "0 */30 * * * *" (every 30 min)
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-prompt">Prompt</Label>
              <Textarea
                id="task-prompt"
                placeholder="What should the AI do when this task runs?"
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
