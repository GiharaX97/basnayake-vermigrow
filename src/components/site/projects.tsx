'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { useContentStore } from '@/store/content-store'

export function Projects() {
  const { content } = useContentStore()
  return (
    <section id="work" className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              Selected work
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              Projects from the field
            </h2>
          </div>
          <p className="text-sm text-muted-foreground max-w-sm md:text-right">
            A rotating selection of recent films, brand systems, and editorial shoots.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {content.projects.map((project, i) => (
            <motion.a
              key={project.id}
              href="#contact"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
              className="group relative block overflow-hidden rounded-2xl bg-muted aspect-[4/5]"
            >
              <img
                src={project.image}
                alt={project.title}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute inset-0 p-5 flex flex-col justify-end text-white">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wider text-amber-300">
                      {project.category} · {project.year}
                    </span>
                    <h3 className="mt-1 text-xl font-semibold">{project.title}</h3>
                  </div>
                  <span className="h-9 w-9 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  )
}
