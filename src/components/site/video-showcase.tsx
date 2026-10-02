'use client'

import * as React from 'react'
import { Play, Clock } from 'lucide-react'
import { useContentStore } from '@/store/content-store'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export function VideoShowcase() {
  const { content } = useContentStore()
  const [active, setActive] = React.useState<number | null>(null)

  // Only entries with a real source are playable. The editor's "Add video" starts
  // a new card with an empty src, and a card that opens a dead player is worse
  // than no card at all — so a half-filled entry is simply not shown until
  // somebody gives it a file.
  const videos = content.videos.filter((v) => v.src.trim() !== '')

  // No farm footage yet, so this renders nothing rather than an empty section
  // with a heading over blank space. The three clips it used to show were
  // Google's gtv-videos-bucket demo files, not this farm — see
  // scripts/migrate-site-content.mjs. Same contract as EventGallery and
  // TrainingVideos. Must sit AFTER every hook.
  if (videos.length === 0) return null

  return (
    <section id="videos" className="py-20 md:py-28 bg-muted/30 border-y border-border/60 scroll-mt-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Farm films
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Video showcase
          </h2>
          <p className="mt-4 text-base md:text-lg text-muted-foreground">
            Short videos from the compost shed, the vermi-beds and harvest day. Click a card to play.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video, i) => (
            <button
              key={video.id}
              onClick={() => setActive(i)}
              className="group text-left rounded-2xl overflow-hidden bg-card border border-border/60 hover:shadow-xl hover:border-emerald-500/40 transition-all"
            >
              <div className="relative aspect-video bg-muted overflow-hidden">
                <img
                  src={video.poster}
                  alt={video.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-14 w-14 rounded-full bg-white/90 group-hover:bg-white text-black flex items-center justify-center shadow-xl transition-transform group-hover:scale-110">
                    <Play className="h-6 w-6 ml-0.5 fill-current" />
                  </div>
                </div>
                <div className="absolute bottom-3 right-3 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-black/70 text-white text-xs font-medium">
                  <Clock className="h-3 w-3" />
                  {video.duration}
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-lg font-semibold">{video.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed line-clamp-2">
                  {video.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={active !== null} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden bg-black border-border/40">
          {active !== null && (
            <>
              <DialogTitle className="sr-only">{videos[active].title}</DialogTitle>
              <DialogDescription className="sr-only">
                {videos[active].description}
              </DialogDescription>
              <video
                key={videos[active].src}
                className="w-full aspect-video object-contain bg-black"
                src={videos[active].src}
                poster={videos[active].poster}
                controls
                autoPlay
                playsInline
              />
              <div className="px-5 py-4 bg-background">
                <h3 className="text-lg font-semibold">{videos[active].title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{videos[active].description}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
