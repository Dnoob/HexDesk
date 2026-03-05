import type { AgentStep } from "@/types"

const PLAN_REGEX = /```json\s*\n?\s*\{"plan"\s*:\s*(\[[\s\S]*?\])\s*\}\s*\n?\s*```|(?:^|\n)\s*\{"plan"\s*:\s*(\[[\s\S]*?\])\s*\}/

export function parsePlan(content: string): AgentStep[] | null {
  const match = PLAN_REGEX.exec(content)
  if (!match) return null

  const arrayStr = match[1] ?? match[2]
  try {
    const raw = JSON.parse(arrayStr) as Array<{ step: number; description: string }>
    if (!Array.isArray(raw) || raw.length === 0) return null
    return raw.map((item, i) => ({
      id: String(item.step ?? i + 1),
      description: item.description,
      status: "pending" as const,
    }))
  } catch {
    return null
  }
}

export function stripPlanJson(content: string): string {
  return content
    .replace(/```json\s*\n?\s*\{"plan"\s*:\s*\[[\s\S]*?\]\s*\}\s*\n?\s*```/g, "")
    .replace(/(?:^|\n)\s*\{"plan"\s*:\s*\[[\s\S]*?\]\s*\}/g, "")
    .trim()
}

interface AgentPlanCardProps {
  steps: AgentStep[]
}

export function AgentPlanCard({ steps }: AgentPlanCardProps) {
  return (
    <div className="my-3 rounded-lg border bg-muted/50 p-3">
      <div className="mb-2 text-xs font-medium text-muted-foreground">
        execution plan
      </div>
      <ol className="space-y-1.5">
        {steps.map((step, i) => (
          <li key={step.id} className="flex items-start gap-2 text-sm">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {i + 1}
            </span>
            <span>{step.description}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
