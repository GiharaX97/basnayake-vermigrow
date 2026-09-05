'use client'

import { Sprout, Target, Eye } from 'lucide-react'
import { useContentStore } from '@/store/content-store'

export function About() {
  const { content } = useContentStore()
  return (
    <section id="about" className="py-20 md:py-28 scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="relative">
            <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-muted">
              <img
                src={content.aboutImage}
                alt={content.aboutTitle}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="absolute -bottom-6 -right-4 sm:-right-6 hidden sm:flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl">
              <Sprout className="h-10 w-10" />
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              About us
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              {content.aboutTitle}
            </h2>
            <p className="mt-6 text-base md:text-lg text-muted-foreground leading-relaxed">
              {content.aboutBody}
            </p>

            <div className="mt-10 grid sm:grid-cols-2 gap-6">
              <div className="rounded-xl border border-border/60 p-5 bg-card">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Target className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wider">Mission</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{content.mission}</p>
              </div>
              <div className="rounded-xl border border-border/60 p-5 bg-card">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Eye className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wider">Vision</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{content.vision}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
