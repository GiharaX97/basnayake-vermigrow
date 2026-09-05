'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, X, ChevronDown } from 'lucide-react'
import { useContentStore } from '@/store/content-store'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel'

export function PhotoCarousel() {
  const { content } = useContentStore()
  const [api, setApi] = React.useState<CarouselApi>()
  const [current, setCurrent] = React.useState(0)
  const [count, setCount] = React.useState(0)
  const [lightbox, setLightbox] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!api) return
    setCount(api.scrollSnapList().length)
    setCurrent(api.selectedScrollSnap())
    api.on('select', () => setCurrent(api.selectedScrollSnap()))
  }, [api])

  React.useEffect(() => {
    if (!api || !lightbox) return
    api.scrollTo(lightbox)
  }, [lightbox, api])

  return (
    <section id="photos" className="py-20 md:py-28 scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Field & shed
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              From the farm
            </h2>
            <p className="mt-4 text-base md:text-lg text-muted-foreground">
              A selection of frames from our compost sheds, vermi-beds and vegetable plots in Karandeniya.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono">{String(current + 1).padStart(2, '0')}</span>
            <span className="h-px w-10 bg-border" />
            <span className="font-mono">{String(count).padStart(2, '0')}</span>
          </div>
        </div>

        <div className="px-2">
          <Carousel
            opts={{ align: 'start', loop: true }}
            setApi={setApi}
            className="w-full"
          >
            <CarouselContent className="-ml-2 md:-ml-4">
              {content.photos.map((photo) => (
                <CarouselItem
                  key={photo.id}
                  className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3"
                >
                  <button
                    onClick={() => setLightbox(content.photos.indexOf(photo))}
                    className="group block w-full text-left"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-muted">
                      <img
                        src={photo.src}
                        alt={photo.caption}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                        decoding="async"
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
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden md:flex -left-4 bg-background border-border shadow-md" />
            <CarouselNext className="hidden md:flex -right-4 bg-background border-border shadow-md" />
            <div className="flex md:hidden items-center justify-center gap-1.5 mt-4 text-xs text-muted-foreground">
              <ChevronDown className="h-3 w-3 -rotate-90" />
              Swipe to browse
              <ChevronDown className="h-3 w-3 rotate-90" />
            </div>
          </Carousel>
        </div>
      </div>

      {/* Lightbox */}
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
              setLightbox((l) => (l! - 1 + content.photos.length) % content.photos.length)
            }}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            aria-label="Next"
            className="absolute right-4 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation()
              setLightbox((l) => (l! + 1) % content.photos.length)
            }}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <figure
            className="max-w-5xl max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={content.photos[lightbox].src}
              alt={content.photos[lightbox].caption}
              className="max-h-[78vh] max-w-full object-contain rounded-lg"
            />
            <figcaption className="mt-4 text-center text-white">
              <span className="text-xs uppercase tracking-wider text-emerald-300">
                {content.photos[lightbox].category}
              </span>
              <p className="text-sm mt-1">{content.photos[lightbox].caption}</p>
            </figcaption>
          </figure>
        </div>
      )}
    </section>
  )
}
