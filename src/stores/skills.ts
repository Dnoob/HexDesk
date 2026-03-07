import { create } from "zustand"
import { persist } from "zustand/middleware"
import { invoke } from "@tauri-apps/api/core"
import type { Skill } from "@/types"
import { builtinSkills } from "@/data/builtin-skills"
import { parseSkillMd, exportToSkillMd } from "@/lib/skill-parser"

interface SkillsState {
  skills: Skill[]
  activatedSkillIds: Set<string>

  getActivatedSkills: () => Skill[]
  getSkillById: (id: string) => Skill | undefined

  toggleSkill: (id: string) => void
  addSkill: (skill: Omit<Skill, "id">) => void
  deleteSkill: (id: string) => void

  getActivatedSkillsMeta: () => { id: string; name: string; description: string }[]
  getSkillInstruction: (id: string) => string | undefined

  importFromText: (text: string) => Skill
  importFromUrl: (url: string) => Promise<Skill>
  exportSkill: (id: string) => string | null
}

export const useSkillsStore = create<SkillsState>()(
  persist(
    (set, get) => ({
      skills: builtinSkills,
      activatedSkillIds: new Set<string>(),

      getActivatedSkills: () => {
        const { skills, activatedSkillIds } = get()
        return skills.filter((s) => activatedSkillIds.has(s.id))
      },

      getSkillById: (id) => {
        return get().skills.find((s) => s.id === id)
      },

      toggleSkill: (id) =>
        set((state) => {
          const next = new Set(state.activatedSkillIds)
          if (next.has(id)) {
            next.delete(id)
          } else {
            next.add(id)
          }
          return { activatedSkillIds: next }
        }),

      addSkill: (skill) =>
        set((state) => ({
          skills: [
            ...state.skills,
            { ...skill, id: crypto.randomUUID() },
          ],
        })),

      deleteSkill: (id) =>
        set((state) => ({
          skills: state.skills.filter((s) => s.builtin || s.id !== id),
          activatedSkillIds: (() => {
            const next = new Set(state.activatedSkillIds)
            next.delete(id)
            return next
          })(),
        })),

      getActivatedSkillsMeta: () => {
        const { skills, activatedSkillIds } = get()
        return skills
          .filter((s) => activatedSkillIds.has(s.id))
          .map((s) => ({ id: s.id, name: s.name, description: s.description }))
      },

      getSkillInstruction: (id) => {
        return get().skills.find((s) => s.id === id)?.instruction
      },

      importFromText: (text) => {
        const parsed = parseSkillMd(text)
        // Deduplicate name
        const existing = get().skills
        let name = parsed.name
        if (existing.some((s) => s.name === name)) {
          let i = 2
          while (existing.some((s) => s.name === `${parsed.name} (${i})`)) i++
          name = `${parsed.name} (${i})`
        }
        const skill: Skill = {
          id: crypto.randomUUID(),
          name,
          description: parsed.description,
          icon: parsed.icon,
          category: parsed.category,
          instruction: parsed.instruction,
          author: parsed.author,
          tags: parsed.tags,
        }
        set((state) => ({ skills: [...state.skills, skill] }))
        return skill
      },

      importFromUrl: async (url) => {
        const text = await invoke<string>("fetch_skill_from_url", { url })
        return get().importFromText(text)
      },

      exportSkill: (id) => {
        const skill = get().skills.find((s) => s.id === id)
        if (!skill) return null
        return exportToSkillMd(skill)
      },
    }),
    {
      name: "hexdesk-skills",
      storage: {
        getItem: (name) => {
          const raw = localStorage.getItem(name)
          if (!raw) return null
          const parsed = JSON.parse(raw)
          if (parsed?.state?.activatedSkillIds) {
            parsed.state.activatedSkillIds = new Set(parsed.state.activatedSkillIds)
          }
          return parsed
        },
        setItem: (name, value) => {
          const serialized = {
            ...value,
            state: {
              ...value.state,
              activatedSkillIds: [...value.state.activatedSkillIds],
            },
          }
          localStorage.setItem(name, JSON.stringify(serialized))
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
      partialize: (state) => ({
        skills: state.skills.filter((s) => !s.builtin),
        activatedSkillIds: state.activatedSkillIds,
      }) as unknown as SkillsState,
      merge: (persisted, current) => {
        const state = persisted as Partial<SkillsState> | undefined
        if (!state) return current
        const customSkills = (state.skills ?? []).filter((s) => !s.builtin)
        return {
          ...current,
          skills: [...builtinSkills, ...customSkills],
          activatedSkillIds: state.activatedSkillIds ?? new Set<string>(),
        }
      },
    },
  ),
)
