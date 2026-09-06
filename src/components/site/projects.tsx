'use client'

import * as React from 'react'
import { ArrowUpRight } from 'lucide-react'
import { useContentStore } from '@/store/content-store'

export function Projects() {
  const { content } = useContentStore()
  return (
    <section id="work" className="py-20 md:py-28 scroll-mt-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Our projects
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              The Basnayaka family of brands
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              Three connected projects under one roof — vermicompost, organic vegetables, and fish-based liquid nutrients.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {content.projects.map((project) => (
            <article
              key={project.id}
              className="group relative overflow-hidden rounded-2xl bg-card border border-border/60 hover:border-emerald-500/40 hover:shadow-xl transition-all"
            >
              {/* Logo header */}
              <div className="relative aspect-[4/3] bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-emerald-950/30 dark:to-amber-950/20 overflow-hidden flex items-center justify-center p-8">
                {project.logo ? (
                  <img
                    src={project.logo}
                    alt={`${project.title} logo`}
                    className="max-h-full max-w-full object-contain transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <img
                    src={project.image}
                    alt={project.title}
                    className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                )}
                <span className="absolute top-3 right-3 text-xs font-medium px-2 py-1 rounded-md bg-background/80 backdrop-blur-md border border-border/40">
                  Est. {project.year}
                </span>
              </div>

              {/* Body */}
              <div className="p-6">
                <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  {project.category}
                </span>
                <h3 className="mt-2 text-xl font-bold tracking-tight">{project.title}</h3>
                {project.description && (
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {project.description}
                  </p>
                )}
                <a
                  href="#contact"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  Enquire about this
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
