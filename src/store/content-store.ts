'use client'

import { create } from 'zustand'
import { persist, type StorageValue } from 'zustand/middleware'
export type {
  SlideItem,
  PhotoItem,
  VideoCard,
  ProductItem,
  StatItem,
  ProjectItem,
  SocialItem,
  MapLocation,
  NoticeItem,
  SiteContent,
} from '@/lib/content-defaults'
export { defaultContent } from '@/lib/content-defaults'

// ---------- Types ----------
import type { SiteContent } from '@/lib/content-defaults'
import { deepMergeDefaults } from '@/lib/content-defaults'
import { defaultContent } from '@/lib/content-defaults'

// ---------- Store ----------
interface ContentState {
  content: SiteContent
  editMode: boolean
  loaded: boolean
  tickerDismissed: boolean
  setContent: (c: SiteContent) => void
  updateField: <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => void
  toggleEditMode: () => void
  resetContent: () => void
  loadFromServer: () => Promise<void>
  dismissTicker: () => void
}

// Generic storage — the persisted type (S) is inferred per-store from `partialize`,
// so persisting a subset of state (e.g. excluding transient `tickerDismissed`) type-checks.
const safeStorage = {
  getItem: <S>(name: string): StorageValue<S> | null => {
    try {
      const raw = window.localStorage.getItem(name)
      return raw ? (JSON.parse(raw) as StorageValue<S>) : null
    } catch { return null }
  },
  setItem: <S>(name: string, value: StorageValue<S>): void => {
    try { window.localStorage.setItem(name, JSON.stringify(value)) } catch {}
  },
  removeItem: (name: string): void => {
    try { window.localStorage.removeItem(name) } catch {}
  },
}

export const useContentStore = create<ContentState>()(
  persist(
    (set) => ({
      content: defaultContent,
      editMode: false,
      loaded: false,
      tickerDismissed: false,
      setContent: (c) => set({ content: c }),
      updateField: (key, value) =>
        set((state) => ({ content: { ...state.content, [key]: value } })),
      toggleEditMode: () => set((state) => ({ editMode: !state.editMode })),
      resetContent: () => set({ content: defaultContent }),
      dismissTicker: () => set({ tickerDismissed: true }),
      loadFromServer: async () => {
        try {
          const res = await fetch('/api/content')
          const data = await res.json()
          if (data) {
            // Migrate old schema: if services exists but products doesn't
            if (!data.products && data.services) {
              data.products = data.services.map((s: any) => ({
                ...s,
                price: '',
                unit: '',
                featured: false,
              }))
              delete data.services
            }
            // Deep-merge with defaults so missing fields (older blobs saved
            // before newer sections were added) keep their defaults
            const merged = deepMergeDefaults(defaultContent, data)
            set({ content: merged, loaded: true })
          } else {
            await fetch('/api/content', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(defaultContent),
            })
            set({ loaded: true })
          }
        } catch {
          set({ loaded: true })
        }
      },
    }),
    {
      name: 'basnayaka-vermigrow-content-v5',
      version: 5,
      partialize: (state) => {
        const { tickerDismissed: _, ...rest } = state
        return rest
      },
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Partial<ContentState>
        // v0/v1 → v2: migrate services to products
        if (version < 2) {
          const old = state as any
          if (old?.state?.services) {
            old.state.products = old.state.services.map((s: any) => ({
              ...s,
              price: '',
              unit: '',
              featured: false,
            }))
            delete old.state.services
          } else if (old?.content?.services) {
            old.content.products = old.content.services.map((s: any) => ({
              ...s,
              price: '',
              unit: '',
              featured: false,
            }))
            delete old.content.services
          }
        }
        // v2 → v4: merge in any new fields from defaultContent
        if (version < 4 && state?.content) {
          state.content = { ...defaultContent, ...state.content }
        }
        return state as ContentState
      },
      storage: safeStorage,
    }
  )
)
