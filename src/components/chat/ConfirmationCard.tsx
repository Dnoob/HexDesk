import { Shield, FileText, Terminal, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useConfirmationStore } from "@/stores/confirmation"
import type { ConfirmationRequest } from "@/types"

function getIconConfig(actionType: ConfirmationRequest["actionType"]) {
  switch (actionType) {
    case "file_read":
      return {
        icon: <FileText className="size-5" />,
        bg: "bg-blue-500/15",
        text: "text-blue-400",
      }
    case "file_write":
      return {
        icon: <FileText className="size-5" />,
        bg: "bg-yellow-500/15",
        text: "text-yellow-400",
      }
    case "shell_execute":
      return {
        icon: <Terminal className="size-5" />,
        bg: "bg-orange-500/15",
        text: "text-orange-400",
      }
    case "file_delete":
      return {
        icon: <Trash2 className="size-5" />,
        bg: "bg-red-500/15",
        text: "text-red-400",
      }
    default:
      return {
        icon: <Shield className="size-5" />,
        bg: "bg-muted",
        text: "text-muted-foreground",
      }
  }
}

export function ConfirmationCard() {
  const pending = useConfirmationStore((s) => s.pending)
  const confirm = useConfirmationStore((s) => s.confirm)
  const reject = useConfirmationStore((s) => s.reject)

  if (!pending) return null

  const { icon, bg, text } = getIconConfig(pending.actionType)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-md rounded-2xl shadow-2xl bg-card">
        <CardHeader className="flex flex-col items-center gap-3 pb-2 pt-6">
          <div
            className={`flex size-12 items-center justify-center rounded-full ${bg} ${text}`}
          >
            {icon}
          </div>
          <CardTitle className="text-center text-base">
            {pending.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-6">
          <p className="text-center text-sm text-muted-foreground">
            {pending.description}
          </p>
          {pending.details && (
            <div className="rounded-lg border bg-background/50 p-3">
              <pre className="font-mono text-xs leading-relaxed text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                <code>{pending.details}</code>
              </pre>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end gap-2 px-6 pb-5">
          <Button
            variant="outline"
            size="sm"
            className="text-red-400 hover:text-red-300 hover:border-red-500/50"
            onClick={() => reject(pending.id)}
          >
            拒绝
          </Button>
          <Button size="sm" onClick={() => confirm(pending.id)}>
            允许
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
