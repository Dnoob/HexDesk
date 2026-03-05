import type { Skill, SkillCategory } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

const categoryLabels: Record<SkillCategory, string> = {
  writing: "写作",
  development: "开发",
  efficiency: "效率",
  translation: "翻译",
  creativity: "创意",
  data: "数据",
  design: "设计",
}

interface SkillDetailDialogProps {
  skill: Skill | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isActivated: boolean
  onToggle: () => void
}

export function SkillDetailDialog({
  skill,
  open,
  onOpenChange,
  isActivated,
  onToggle,
}: SkillDetailDialogProps) {
  if (!skill) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-hex-blue/20 bg-card/95 backdrop-blur-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-4xl">{skill.icon}</span>
            <div className="flex flex-col gap-1">
              <span>{skill.name}</span>
              <div className="flex items-center gap-2">
                {skill.author && (
                  <span className="text-xs font-normal text-muted-foreground">
                    by {skill.author}
                  </span>
                )}
                <Badge variant="outline" className="text-[10px]">
                  {categoryLabels[skill.category]}
                </Badge>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="flex flex-col gap-4 pr-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {skill.description}
            </p>

            {skill.demoPrompt && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  示例输入
                </span>
                <div className="rounded-lg border border-hex-blue/20 bg-muted/50 p-3">
                  <code className="text-xs text-foreground/80 whitespace-pre-wrap">
                    {skill.demoPrompt}
                  </code>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border border-hex-blue/20 p-3">
              <span className="text-sm font-medium">
                {isActivated ? "已激活" : "未激活"}
              </span>
              <Switch
                checked={isActivated}
                onCheckedChange={onToggle}
              />
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
