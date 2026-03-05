import { useState, useMemo } from "react"
import { Search, Plus, Sparkles } from "lucide-react"
import { useSkillsStore } from "@/stores/skills"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SkillDetailDialog } from "./SkillDetailDialog"
import type { Skill, SkillCategory } from "@/types"

const categoryLabels: Record<SkillCategory, string> = {
  writing: "写作",
  development: "开发",
  efficiency: "效率",
  translation: "翻译",
  creativity: "创意",
  data: "数据",
  design: "设计",
}

const allCategories: Array<SkillCategory | "all"> = [
  "all",
  "writing",
  "development",
  "efficiency",
  "design",
  "translation",
  "creativity",
  "data",
]

const categoryTabLabels: Record<string, string> = {
  all: "全部",
  ...categoryLabels,
}

export default function SkillsMarket() {
  const skills = useSkillsStore((s) => s.skills)
  const activatedSkillIds = useSkillsStore((s) => s.activatedSkillIds)
  const toggleSkill = useSkillsStore((s) => s.toggleSkill)

  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<SkillCategory | "all">("all")
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const activatedCount = activatedSkillIds.size

  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      const matchesCategory = activeTab === "all" || skill.category === activeTab
      const matchesSearch =
        !search ||
        skill.name.toLowerCase().includes(search.toLowerCase()) ||
        skill.description.toLowerCase().includes(search.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [skills, activeTab, search])

  const handleCardClick = (skill: Skill) => {
    setSelectedSkill(skill)
    setDetailOpen(true)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-6 py-6">
          {/* Top bar: search + action buttons */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="搜索技能..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-lg border border-hex-blue/20 bg-card/80 pl-9 pr-3 text-sm outline-none backdrop-blur transition-colors placeholder:text-muted-foreground focus:border-hex-cyan/40"
              />
            </div>
            <button className="flex h-9 items-center gap-1.5 rounded-lg border border-hex-blue/20 bg-card/80 px-3 text-sm text-muted-foreground backdrop-blur transition-colors hover:border-hex-cyan/40 hover:text-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              通过 AI 创建
            </button>
            <div className="flex h-9 items-center gap-1.5 rounded-lg border border-hex-cyan/30 bg-hex-cyan/5 px-3 text-sm text-hex-cyan">
              <Plus className="h-3.5 w-3.5" />
              已激活 {activatedCount}
            </div>
          </div>

          {/* Banner */}
          <div className="mt-5 rounded-2xl bg-gradient-to-r from-hex-cyan/20 via-hex-blue/20 to-hex-cyan/10 p-6">
            <h2 className="text-xl font-semibold">探索实用技能</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              涵盖写作、开发、效率、设计等多种场景，一键激活增强 AI 能力
            </p>
          </div>

          {/* Category tabs */}
          <div className="mt-5 flex gap-2 overflow-x-auto">
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  activeTab === cat
                    ? "bg-hex-cyan/15 text-hex-cyan border border-hex-cyan/30"
                    : "border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {categoryTabLabels[cat]}
              </button>
            ))}
          </div>

          {/* Skills grid */}
          <div className="mt-5 grid grid-cols-3 gap-3 pb-6">
            {filteredSkills.map((skill) => {
              const isActivated = activatedSkillIds.has(skill.id)
              return (
                <div
                  key={skill.id}
                  onClick={() => handleCardClick(skill)}
                  className={`flex cursor-pointer flex-col gap-3 rounded-xl border p-4 transition-all hover:shadow-[0_0_12px_rgba(0,200,255,0.05)] ${
                    isActivated
                      ? "border-hex-cyan/40 bg-hex-cyan/5"
                      : "border-hex-blue/20 hover:border-hex-cyan/40"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-3xl">{skill.icon}</span>
                    <Switch
                      checked={isActivated}
                      onCheckedChange={() => toggleSkill(skill.id)}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    />
                  </div>
                  <div>
                    <div className="font-medium">{skill.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {skill.description}
                    </div>
                  </div>
                  <Badge variant="outline" className="w-fit text-[10px]">
                    {categoryLabels[skill.category]}
                  </Badge>
                </div>
              )
            })}
          </div>

          {filteredSkills.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Search className="mb-3 h-8 w-8 opacity-40" />
              <p className="text-sm">没有找到匹配的技能</p>
            </div>
          )}
        </div>
      </ScrollArea>

      <SkillDetailDialog
        skill={selectedSkill}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        isActivated={selectedSkill ? activatedSkillIds.has(selectedSkill.id) : false}
        onToggle={() => {
          if (selectedSkill) toggleSkill(selectedSkill.id)
        }}
      />
    </div>
  )
}
