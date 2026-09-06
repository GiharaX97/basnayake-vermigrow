'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useContentStore } from '@/store/content-store'

export function TrainingGallery() {
  const { content } = useContentStore()
  const [lightbox, setLightbox] = React.useState<number | null>(null)

  const photos = content.trainingPhotos || []

  if (photos.length === 0) return null

  return (
    <section id="training" className="py-20 md:py-28 bg-muted/30 border-y border-border/60 scroll-mt-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Training Programmes
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Training gallery
          </h2>
          <p className="mt-4 text-base md:text-lg text-muted-foreground">
            Photos from our training programmes conducted by Mr. Basnayaka for farmers across Sri Lanka.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              onClick={() => setLightbox(i)}
              className="group block w-full text-left"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
                <img
                  src={photo.src}
                  alt={photo.caption}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs font-medium uppercase tracking-wider text-emerald-300">
                    {photo.category}
                  </span>
                  <p className="text-sm font-medium mt-1">{photo.caption}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {lightbox !== null && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            aria-label="Close"
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            onClick={() => setLightbox(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <button
            aria-label="Previous"
            className="absolute left-4 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation()
              setLightbox((l) => (l! - 1 + photos.length) % photos.length)
            }}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            aria-label="Next"
            className="absolute right-4 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation()
              setLightbox((l) => (l! + 1) % photos.length)
            }}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <figure
            className="max-w-5xl max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photos[lightbox].src}
              alt={photos[lightbox].caption}
              className="max-h-[78vh] max-w-full object-contain rounded-lg"
            />
            <figcaption className="mt-4 text-center text-white">
              <span className="text-xs uppercase tracking-wider text-emerald-300">
                {photos[lightbox].category}
              </span>
              <p className="text-sm mt-1">{photos[lightbox].caption}</p>
            </figcaption>
          </figure>
        </div>
      )}
    </section>
  )
}