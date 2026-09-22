'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { useStore } from 'zustand'
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
import { defaultContent } from '@/lib/content-defaults'

export interface ContentState {
  content: SiteContent
  editMode: boolean
  loaded: boolean
  tickerDismissed: boolean
  setContent: (c: SiteContent) => void
  updateField: <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => void
  toggleEditMode: () => void
  resetContent: () => void
  dismissTicker: () => void
}

/**
 * A store instance, not a singleton.
 *
 * This used to be one module-level `create(persist(...))` store. That is fine in
 * the browser but wrong on the server: a module-level store is shared by every
 * concurrent request, so seeding it per-request would let two requests interleave
 * and render one visitor's content into another visitor's page. Each request (and
 * each mount) now gets its own instance, created by `ContentProvider`.
 *
 * `persist` is deliberately gone. Server content is the single source of truth, so
 * a localStorage copy is obsolete — and it was actively harmful: rehydrating to
 * different content than the server had rendered is a hydration mismatch. The
 * stale `basnayaka-vermigrow-content-v5` key is simply ignored now.
 */
export function createContentStore(initialContent: SiteContent): StoreApi<ContentState> {
  return createStore<ContentState>()((set) => ({
    content: initialContent,
    editMode: false,
    // Content is present from the first render now, so there is no loading state.
    loaded: true,
    tickerDismissed: false,
    setContent: (c) => set({ content: c }),
    updateField: (key, value) =>
      set((state) => ({ content: { ...state.content, [key]: value } })),
    toggleEditMode: () => set((state) => ({ editMode: !state.editMode })),
    resetContent: () => set({ content: defaultContent }),
    dismissTicker: () => set({ tickerDismissed: true }),
  }))
}

/**
 * Safety net for any component that renders outside a provider, so a missing
 * provider degrades to default content instead of throwing at render time.
 */
const fallbackStore = createContentStore(defaultContent)

const ContentContext = createContext<StoreApi<ContentState> | null>(null)

export function ContentProvider({
  initialContent,
  children,
}: {
  initialContent: SiteContent
  children: ReactNode
}) {
  // `useState` with an initialiser builds the store exactly once and keeps its
  // identity stable across renders — the same create-once guarantee as the usual
  // `useRef` idiom, without reading a ref during render (which React's lint rules
  // reject, and which is unsafe under concurrent rendering anyway).
  const [store] = useState(() => createContentStore(initialContent))

  // After a revalidation the server can hand down a new content object without
  // remounting this provider (a client-side navigation). Keep the store in step.
  // The ref guard makes the initial mount a no-op rather than a wasted re-render.
  const synced = useRef(initialContent)
  useEffect(() => {
    if (synced.current === initialContent) return
    synced.current = initialContent
    store.getState().setContent(initialContent)
  }, [store, initialContent])

  return <ContentContext.Provider value={store}>{children}</ContentContext.Provider>
}

const identity = (state: ContentState) => state

/**
 * Same call signature as the old singleton hook, so every existing consumer —
 * `useContentStore()` and `useContentStore((s) => s.loaded)` alike — is unchanged.
 */
export function useContentStore(): ContentState
export function useContentStore<T>(selector: (state: ContentState) => T): T
export function useContentStore<T>(selector?: (state: ContentState) => T) {
  const store = useContext(ContentContext) ?? fallbackStore
  return useStore(store, selector ?? (identity as unknown as (state: ContentState) => T))
}
