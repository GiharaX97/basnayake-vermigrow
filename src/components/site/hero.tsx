'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useContentStore } from '@/store/content-store'
import { cn } from '@/lib/utils'

export function Hero() {
  const { content } = useContentStore()
  const slides = content.heroSlides
  const [index, setIndex] = React.useState(0)
  const [paused, setPaused] = React.useState(false)
  const videoRefs = React.useRef<(HTMLVideoElement | null)[]>([])

  const go = React.useCallback(
    (next: number) => setIndex((next + slides.length) % slides.length),
    [slides.length]
  )

  // Auto-advance slides every 7s (only when not paused)
  React.useEffect(() => {
    if (paused) return
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length)
    }, 7000)
    return () => clearInterval(t)
  }, [paused, slides.length])

  // Sync videos to current slide
  React.useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return
      if (i === index && !paused) {
        v.currentTime = 0
        v.play().catch(() => {})
      } else {
        v.pause()
      }
    })
  }, [index, paused])

  const current = slides[index]

  return (
    <section
      id="top"
      className="relative h-[100svh] w-full overflow-hidden bg-foreground"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      <AnimatePresence mode="popLayout">
        {slides.map((slide, i) => (
          <motion.div
            key={slide.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: i === index ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
            className="absolute inset-0"
            aria-hidden={i !== index}
          >
            {slide.type === 'video' ? (
              <video
                ref={(el) => { videoRefs.current[i] = el }}
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
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/40 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 h-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-20 md:pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="max-w-3xl"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/90 text-xs font-medium tracking-wide uppercase mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {content.tagline}
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight text-white drop-shadow-lg leading-[1.05]">
              {current.title}
            </h1>
            <p className="mt-5 text-base sm:text-lg md:text-xl text-white/85 max-w-xl">
              {current.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="rounded-full bg-emerald-500 text-white hover:bg-emerald-600">
                <a href="#work">View our work</a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full bg-transparent border-white/40 text-white hover:bg-white/10 hover:text-white"
              >
                <a href="#contact">Start a project</a>
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="absolute bottom-6 right-4 sm:right-6 lg:right-8 z-20 flex items-center gap-2">
        <button
          aria-label="Previous slide"
          onClick={() => go(index - 1)}
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          aria-label={paused ? 'Play slideshow' : 'Pause slideshow'}
          onClick={() => setPaused((p) => !p)}
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-colors"
        >
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
        <button
          aria-label="Next slide"
          onClick={() => go(index + 1)}
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Slide dots */}
      <div className="absolute bottom-6 left-4 sm:left-6 lg:left-8 z-20 flex items-center gap-1.5">
        {slides.map((s, i) => (
          <button
            key={s.id}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => go(i)}
            className={cn(
              'h-1.5 rounded-full transition-all duration-500',
              i === index ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'
            )}
          />
        ))}
      </div>
    </section>
  )
}
