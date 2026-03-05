import { Shield, FileText, Terminal, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useConfirmationStore } from "@/stores/confirmation"
import type { ConfirmationRequest } from "@/types"

function getIcon(actionType: ConfirmationRequest["actionType"]) {
  switch (actionType) {
    case "file_read":
      return <FileText className="size-5 text-blue-500" />
    case "file_write":
      return <FileText className="size-5 text-yellow-500" />
    case "shell_execute":
      return <Terminal className="size-5 text-orange-500" />
    case "file_delete":
      return <Trash2 className="size-5 text-red-500" />
    default:
      return <Shield className="size-5 text-muted-foreground" />
  }
}

export function ConfirmationCard() {
  const pending = useConfirmationStore((s) => s.pending)
  const confirm = useConfirmationStore((s) => s.confirm)
  const reject = useConfirmationStore((s) => s.reject)

  if (!pending) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center gap-3 pb-3">
          {getIcon(pending.actionType)}
          <CardTitle className="text-base">{pending.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">{pending.description}</p>
          {pending.details && (
            <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
              <code>{pending.details}</code>
            </pre>
          )}
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button variant="destructive" size="sm" onClick={() => reject(pending.id)}>
            Reject
          </Button>
          <Button size="sm" onClick={() => confirm(pending.id)}>
            Allow
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
