'use client'

import * as React from 'react'
import { Calendar, MapPin, X } from 'lucide-react'
import { useContentStore } from '@/store/content-store'
import type { NoticeItem } from '@/store/content-store'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export function NoticeTicker() {
  const { content, tickerDismissed, dismissTicker } = useContentStore()
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [selected, setSelected] = React.useState<NoticeItem | null>(null)

  const notices = content.notices || []

  React.useEffect(() => {
    if (notices.length < 2) return
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % notices.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [notices.length])

  if (notices.length === 0 || tickerDismissed) return null

  const notice = notices[activeIndex]

  return (
    <>
      <div className="fixed top-0 inset-x-0 z-[60] bg-emerald-700 text-white text-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 shrink-0 text-xs font-semibold uppercase tracking-wider bg-emerald-600/50 px-2.5 py-1 rounded-full">
              <Calendar className="h-3 w-3" />
              {notice?.type === 'training' ? 'Training' : 'Event'}
            </span>
            <span className="text-sm font-medium truncate">
              {notice?.title}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-200 shrink-0">
              <MapPin className="h-3 w-3" />
              {notice?.location}
            </span>
            <span className="hidden sm:inline text-xs text-emerald-200 shrink-0">
              {notice?.date}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSelected(notice)}
              className="text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-full transition-colors"
            >
              Details
            </button>
            <button
              type="button"
              onClick={dismissTicker}
              className="text-emerald-200 hover:text-white transition-colors"
              aria-label="Dismiss notices"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogTitle>{selected.title}</DialogTitle>
              <DialogDescription className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                  <span>{selected.date}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  <span>{selected.location}</span>
                </div>
                <p className="text-sm text-muted-foreground">{selected.description}</p>
              </DialogDescription>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}