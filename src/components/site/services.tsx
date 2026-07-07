'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Film, Camera, Palette, Sprout, type LucideIcon } from 'lucide-react'
import { useContentStore } from '@/store/content-store'

const iconMap: Record<string, LucideIcon> = {
  Film,
  Camera,
  Palette,
  Sprout,
}

export function Services() {
  const { content } = useContentStore()
  return (
    <section id="services" className="py-20 md:py-28 bg-muted/30 border-y border-border/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            What we do
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Services grown with care
          </h2>
          <p className="mt-4 text-base md:text-lg text-muted-foreground">
            From the first sketch to the final cut, we cover every step of the storytelling process — for brands, makers, and communities rooted in real places.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {content.services.map((service, i) => {
            const Icon = iconMap[service.icon] ?? Sprout
            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group rounded-2xl border border-border/60 bg-card p-6 hover:border-amber-500/40 hover:shadow-lg transition-all"
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{service.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {service.description}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
