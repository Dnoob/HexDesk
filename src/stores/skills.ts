import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Skill } from "@/types"

const builtinSkills: Skill[] = [
  {
    id: "builtin-translate",
    name: "Translate",
    description: "Translate text to another language",
    icon: "\u{1F310}",
    prompt: "Please translate the following text to {{target_language}}:\n\n{{text}}",
    variables: [
      {
        name: "target_language",
        label: "Target Language",
        type: "select",
        options: ["English", "Japanese", "Korean", "French", "Chinese"],
      },
      { name: "text", label: "Text", type: "text" },
    ],
    builtin: true,
  },
  {
    id: "builtin-code-review",
    name: "Code Review",
    description: "Review code and suggest improvements",
    icon: "\u{1F50D}",
    prompt: "Please review the following code, point out issues and suggest improvements:\n\n```{{language}}\n{{code}}\n```",
    variables: [
      {
        name: "language",
        label: "Language",
        type: "text",
        placeholder: "python",
      },
      { name: "code", label: "Code", type: "text" },
    ],
    builtin: true,
  },
  {
    id: "builtin-summarize",
    name: "Summarize",
    description: "Summarize document key points",
    icon: "\u{1F4DD}",
    prompt: "Please summarize the key points of the following document:\n\n{{content}}",
    variables: [{ name: "content", label: "Content", type: "text" }],
    builtin: true,
  },
  {
    id: "builtin-write-email",
    name: "Write Email",
    description: "Draft an email from key points",
    icon: "\u{2709}\u{FE0F}",
    prompt: "Please write a {{tone}} email based on the following key points:\n\n{{points}}",
    variables: [
      {
        name: "tone",
        label: "Tone",
        type: "select",
        options: ["Formal", "Friendly", "Brief"],
      },
      { name: "points", label: "Key Points", type: "text" },
    ],
    builtin: true,
  },
]

interface SkillsState {
  skills: Skill[]
  addSkill: (skill: Omit<Skill, "id">) => void
  updateSkill: (id: string, updates: Partial<Skill>) => void
  deleteSkill: (id: string) => void
}

export const useSkillsStore = create<SkillsState>()(
  persist(
    (set) => ({
      skills: builtinSkills,

      addSkill: (skill) =>
        set((state) => ({
          skills: [
            ...state.skills,
            { ...skill, id: crypto.randomUUID() },
          ],
        })),

      updateSkill: (id, updates) =>
        set((state) => ({
          skills: state.skills.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),

      deleteSkill: (id) =>
        set((state) => ({
          skills: state.skills.filter((s) => s.builtin || s.id !== id),
        })),
    }),
    {
      name: "hexdesk-skills",
      merge: (persisted, current) => {
        const state = persisted as SkillsState | undefined
        if (!state) return current
        const customSkills = state.skills.filter((s) => !s.builtin)
        return { ...current, skills: [...builtinSkills, ...customSkills] }
      },
    },
  ),
)
