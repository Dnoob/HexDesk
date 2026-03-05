import { create } from "zustand"
import { listen } from "@tauri-apps/api/event"
import { invoke } from "@tauri-apps/api/core"
import type { ConfirmationRequest } from "@/types"

interface ConfirmationState {
  pending: ConfirmationRequest | null
  listen: () => Promise<void>
  confirm: (id: string) => void
  reject: (id: string) => void
}

export const useConfirmationStore = create<ConfirmationState>((set) => ({
  pending: null,

  listen: async () => {
    await listen<ConfirmationRequest>("confirmation:request", (event) => {
      set({ pending: event.payload })
    })
  },

  confirm: (id: string) => {
    void invoke("respond_confirmation", { id, approved: true })
    set({ pending: null })
  },

  reject: (id: string) => {
    void invoke("respond_confirmation", { id, approved: false })
    set({ pending: null })
  },
}))
