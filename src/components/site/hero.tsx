'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useContentStore } from '@/store/content-store'
import { cn } from '@/lib/utils'

export function Hero() {
  const { content } = useContentStore()
  const slides = content.heroSlides
  const [index, setIndex] = React.useState(0)
  const [paused, setPaused] = React.useState(false)
  const videoRef = React.useRef<HTMLVideoElement>(null)

  const go = React.useCallback(
    (next: number) => setIndex((next + slides.length) % slides.length),
    [slides.length]
  )

  React.useEffect(() => {
    if (paused) return
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length)
    }, 7000)
    return () => clearInterval(t)
  }, [paused, slides.length])

  React.useEffect(() => {
    if (!videoRef.current) return
    videoRef.current.currentTime = 0
    videoRef.current.play().catch(() => {})
  }, [index])

  const current = slides[index]

  return (
    <section
      id="top"
      className="relative w-full h-dvh overflow-hidden bg-foreground"
    >
      {/* Slides backdrop */}
      {slides.map((slide, i) => (
        <div
          key={slide.id}
          className={cn(
            'absolute inset-0 transition-opacity duration-1000',
            i === index ? 'opacity-100' : 'opacity-0'
          )}
          aria-hidden={i !== index}
          style={{ pointerEvents: 'none' }}
        >
          {slide.type === 'video' ? (
            <video
              ref={i === index ? videoRef : undefined}
              className="h-full w-full object-cover"
              src={slide.src}
              poster={slide.poster}
              muted
              loop
              playsInline
              preload="metadata"
            />
          ) : (
            <img
              src={slide.src}
              alt={slide.title || 'Hero image'}
              className="h-full w-full object-cover"
              loading={i === 0 ? 'eager' : 'lazy'}
            />
          )}
        </div>
      ))}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/40 pointer-events-none z-[1]" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent pointer-events-none z-[1]" />

      {/* Text content — doesn't block clicks on controls below */}
      <div className="absolute inset-x-0 bottom-24 sm:bottom-28 z-[2] pointer-events-none">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/90 text-xs font-medium tracking-wide uppercase mb-5 pointer-events-auto">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {content.tagline}
            </span>
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight text-white drop-shadow-lg leading-[1.05] pointer-events-auto">
              {current.title}
            </h1>
            <p className="mt-5 text-base sm:text-lg md:text-xl text-white/85 max-w-xl pointer-events-auto">
              {current.subtitle}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pointer-events-auto">
              <Button asChild size="lg" className="rounded-full bg-emerald-500 text-white hover:bg-emerald-600 w-full sm:w-auto">
                <a href="#work">View our work</a>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full bg-transparent border-white/40 text-white hover:bg-white/10 hover:text-white w-full sm:w-auto">
                <a href="#contact">Start a project</a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll-down chevron hint for mobile */}
      <div className="absolute bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-[2] pointer-events-none animate-bounce hidden max-sm:block">
        <div className="h-8 w-5 rounded-full border-2 border-white/40 flex items-start justify-center pt-1.5">
          <div className="h-1.5 w-1 rounded-full bg-white/70" />
        </div>
      </div>

      {/* Controls — on top of everything, always clickable */}
      <div className="absolute bottom-6 inset-x-0 z-[3]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => go(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-500 touch-[manipulation]',
                  i === index ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => go(index - 1)}
              className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-colors active:bg-white/30 touch-[manipulation]"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label={paused ? 'Play slideshow' : 'Pause slideshow'}
              onClick={() => setPaused((p) => !p)}
              className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-colors active:bg-white/30 touch-[manipulation]"
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => go(index + 1)}
              className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-colors active:bg-white/30 touch-[manipulation]"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
