import type { Skill, SkillCategory } from "@/types"

interface ParsedSkill {
  name: string
  description: string
  icon: string
  category: SkillCategory
  author?: string
  tags?: string[]
  instruction: string
}

function parseSimpleYaml(text: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {}
  for (const line of text.split("\n")) {
    const match = line.match(/^(\w+):\s*(.+)$/)
    if (!match) continue
    const [, key, rawValue] = match
    let value = rawValue.trim()
    // Handle quoted strings
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    // Handle arrays: [a, b, c]
    if (value.startsWith("[") && value.endsWith("]")) {
      result[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean)
    } else {
      result[key] = value
    }
  }
  return result
}

export function parseSkillMd(text: string): ParsedSkill {
  const frontmatterMatch = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!frontmatterMatch) {
    return {
      name: "Imported Skill",
      description: "",
      icon: "📦",
      category: "efficiency",
      instruction: text.trim(),
    }
  }

  const meta = parseSimpleYaml(frontmatterMatch[1])
  const instruction = frontmatterMatch[2].trim()

  return {
    name: (meta.name as string) ?? "Imported Skill",
    description: (meta.description as string) ?? "",
    icon: (meta.icon as string) ?? "📦",
    category: ((meta.category as string) ?? "efficiency") as SkillCategory,
    author: meta.author as string | undefined,
    tags: Array.isArray(meta.tags) ? meta.tags : undefined,
    instruction,
  }
}

export function exportToSkillMd(skill: Skill): string {
  const lines = [
    "---",
    `name: ${skill.name}`,
    `description: ${skill.description}`,
    `icon: "${skill.icon}"`,
    `category: ${skill.category}`,
  ]
  if (skill.author) lines.push(`author: ${skill.author}`)
  if (skill.tags?.length) lines.push(`tags: [${skill.tags.join(", ")}]`)
  lines.push("---")

  return `${lines.join("\n")}\n\n${skill.instruction}\n`
}
