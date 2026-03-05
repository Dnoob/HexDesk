import type { AgentStep } from "@/types"

const PLAN_REGEX =
  /```json\s*\n?\s*\{"plan"\s*:\s*(\[[\s\S]*?\])\s*\}\s*\n?\s*```|(?:^|\n)\s*\{"plan"\s*:\s*(\[[\s\S]*?\])\s*\}/

export function parsePlan(content: string): AgentStep[] | null {
  const match = PLAN_REGEX.exec(content)
  if (!match) return null

  const arrayStr = match[1] ?? match[2]
  try {
    const raw = JSON.parse(arrayStr) as Array<{
      step: number
      description: string
    }>
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
    .replace(
      /```json\s*\n?\s*\{"plan"\s*:\s*\[[\s\S]*?\]\s*\}\s*\n?\s*```/g,
      "",
    )
    .replace(/(?:^|\n)\s*\{"plan"\s*:\s*\[[\s\S]*?\]\s*\}/g, "")
    .trim()
}

interface AgentPlanCardProps {
  steps: AgentStep[]
}

export function AgentPlanCard({ steps }: AgentPlanCardProps) {
  return (
    <div className="my-3 rounded-xl border bg-card p-4">
      <div className="mb-3 text-sm font-semibold text-hex-cyan">
        执行计划
      </div>
      <ol className="relative space-y-0">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          return (
            <li key={step.id} className="relative flex items-start gap-3 pb-4">
              {/* 连接线 */}
              {!isLast && (
                <div className="absolute top-5 left-[9px] h-[calc(100%-8px)] w-px bg-border" />
              )}
              {/* 编号圆圈 */}
              <span className="relative z-10 flex size-[22px] shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {i + 1}
              </span>
              {/* 描述 */}
              <span className="pt-px text-sm text-foreground/90">
                {step.description}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
