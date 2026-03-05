import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSkillsStore } from "@/stores/skills"
import type { Skill } from "@/types"

interface SkillsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSend: (message: string) => void
}

export function SkillsPanel({ open, onOpenChange, onSend }: SkillsPanelProps) {
  const skills = useSkillsStore((s) => s.skills)
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)

  function handleSkillClick(skill: Skill) {
    if (!skill.variables || skill.variables.length === 0) {
      onSend(skill.prompt)
      onOpenChange(false)
      return
    }
    setSelectedSkill(skill)
  }

  function handleClose() {
    setSelectedSkill(null)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open && !selectedSkill} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg border-hex-blue/30 bg-background/95 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-hex-cyan">
              技能
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {skills.map((skill) => (
              <button
                key={skill.id}
                type="button"
                onClick={() => handleSkillClick(skill)}
                className="flex items-start gap-3 rounded-xl border border-hex-blue/20 p-3 text-left transition-all hover:border-hex-cyan/40 hover:bg-hex-blue/10 hover:shadow-[0_0_12px_rgba(0,200,255,0.05)]"
              >
                <span className="text-2xl leading-none">{skill.icon}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{skill.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {skill.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {selectedSkill && (
        <SkillVariablesDialog
          skill={selectedSkill}
          onSubmit={(message) => {
            onSend(message)
            handleClose()
          }}
          onCancel={() => setSelectedSkill(null)}
        />
      )}
    </>
  )
}

interface SkillVariablesDialogProps {
  skill: Skill
  onSubmit: (message: string) => void
  onCancel: () => void
}

function SkillVariablesDialog({
  skill,
  onSubmit,
  onCancel,
}: SkillVariablesDialogProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const v of skill.variables ?? []) {
      init[v.name] = v.type === "select" && v.options?.length ? v.options[0] : ""
    }
    return init
  })

  function handleSubmit() {
    let result = skill.prompt
    for (const v of skill.variables ?? []) {
      result = result.split(`{{${v.name}}}`).join(values[v.name] ?? "")
    }
    onSubmit(result)
  }

  const canSubmit = (skill.variables ?? []).every(
    (v) => (values[v.name] ?? "").trim().length > 0
  )

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-lg border-hex-blue/30 bg-background/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="text-hex-cyan">
            {skill.icon} {skill.name}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {(skill.variables ?? []).map((variable) => (
            <div key={variable.name} className="flex flex-col gap-1.5">
              <Label
                htmlFor={`skill-var-${variable.name}`}
                className="text-muted-foreground"
              >
                {variable.label}
              </Label>
              {variable.type === "select" && variable.options ? (
                <Select
                  value={values[variable.name]}
                  onValueChange={(val) =>
                    setValues((prev) => ({ ...prev, [variable.name]: val }))
                  }
                >
                  <SelectTrigger
                    id={`skill-var-${variable.name}`}
                    className="w-full border-hex-blue/20 focus:border-hex-cyan/50"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {variable.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : variable.name === "code" || variable.name === "content" || variable.name === "text" || variable.name === "points" ? (
                <Textarea
                  id={`skill-var-${variable.name}`}
                  value={values[variable.name]}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      [variable.name]: e.target.value,
                    }))
                  }
                  placeholder={variable.placeholder}
                  rows={4}
                  className="resize-none border-hex-blue/20 focus:border-hex-cyan/50"
                />
              ) : (
                <Input
                  id={`skill-var-${variable.name}`}
                  value={values[variable.name]}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      [variable.name]: e.target.value,
                    }))
                  }
                  placeholder={variable.placeholder}
                  className="border-hex-blue/20 focus:border-hex-cyan/50"
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} className="border-hex-blue/30">
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-hex-blue/80 hover:bg-hex-blue text-white"
          >
            发送
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
