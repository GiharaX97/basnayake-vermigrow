'use client'

import { useContentStore } from '@/store/content-store'

export function Stats() {
  const { content } = useContentStore()
  return (
    <section className="border-y border-border/60 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
          {content.stats.map((stat) => (
            <div
              key={stat.id}
              className="text-center md:text-left"
            >
              <div className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                {stat.value}
              </div>
              <div className="mt-2 text-sm text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
