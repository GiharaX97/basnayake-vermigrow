'use client'

import { useContentStore } from '@/store/content-store'
import { Loader2 } from 'lucide-react'

export function LoadingOverlay() {
  const loaded = useContentStore((s) => s.loaded)

  if (loaded) return null

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center gap-4 transition-opacity duration-500">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      <p className="text-sm text-muted-foreground animate-pulse">Loading Basnayaka VermiGrow...</p>
    </div>
  )
}
