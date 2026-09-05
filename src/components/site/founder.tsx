'use client'

import * as React from 'react'
import { Quote, Award, Calendar, Sprout, BadgeCheck, BookOpen } from 'lucide-react'
import { useContentStore } from '@/store/content-store'

export function Founder() {
  const { content } = useContentStore()
  const founder = content.founder

  return (
    <section id="founder" className="py-20 md:py-28 bg-gradient-to-b from-emerald-50/50 to-white dark:from-emerald-950/10 dark:to-background border-y border-border/60 scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="max-w-2xl mb-12">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Meet the founder
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            The person behind the soil
          </h2>
          <p className="mt-4 text-base md:text-lg text-muted-foreground">
            Lolitha Basnayaka&rsquo;s journey from traditional farming to certified organic composting.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-10 lg:gap-16">
          {/* Left: Profile card */}
          <div className="lg:col-span-2">
            <div className="sticky top-28 space-y-6">
              {/* Photo */}
              <div className="relative mx-auto max-w-xs lg:max-w-none">
                <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-muted shadow-xl ring-1 ring-border/10">
                  <img
                    src={founder.image}
                    alt={founder.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                {/* Decorative badge */}
                <div className="absolute -bottom-4 -right-4 hidden sm:flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/30">
                  <Sprout className="h-9 w-9" />
                </div>
              </div>

              {/* Quick info */}
              <div className="rounded-xl border border-border/60 bg-card p-5 text-center lg:text-left">
                <h3 className="text-xl font-bold">{founder.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{founder.title}</p>

                {/* Quote */}
                <div className="mt-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-4 border border-emerald-100 dark:border-emerald-900/30">
                  <Quote className="h-5 w-5 text-emerald-500 mb-2" />
                  <p className="text-sm italic text-emerald-800 dark:text-emerald-200 leading-relaxed">
                    &ldquo;{founder.quote}&rdquo;
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Bio & achievements */}
          <div className="lg:col-span-3 space-y-10">
            {/* Bio */}
            <div>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-4">
                <BookOpen className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-wider">His story</span>
              </div>
              <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-muted-foreground leading-relaxed space-y-4">
                {founder.bio.split('\n').map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </div>

            {/* Achievements timeline */}
            <div>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-6">
                <Award className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-wider">Achievements & milestones</span>
              </div>

              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-emerald-400 to-emerald-200 dark:from-emerald-600 dark:to-emerald-800 rounded-full" />

                <div className="space-y-6">
                  {founder.achievements.slice().reverse().map((achievement, i) => (
                    <div key={achievement.id} className="relative pl-12">
                      {/* Timeline dot */}
                      <div className="absolute left-[11px] top-1 h-[18px] w-[18px] rounded-full bg-emerald-500 dark:bg-emerald-400 border-2 border-background ring-2 ring-emerald-200 dark:ring-emerald-800 z-10 flex items-center justify-center">
                        <BadgeCheck className="h-3 w-3 text-white" />
                      </div>

                      <div className="rounded-lg border border-border/60 bg-card p-4 hover:border-emerald-500/30 transition-colors">
                        <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {achievement.year}
                        </div>
                        <p className="text-sm text-foreground/90 leading-relaxed">
                          {achievement.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Call to action */}
            <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 md:p-8 text-white">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                  <Sprout className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold">Want to learn from his experience?</h4>
                  <p className="text-sm text-emerald-100 mt-1">
                    Lolitha regularly conducts farm visits and training sessions for fellow farmers in Southern Province.
                  </p>
                </div>
                <a
                  href="#contact"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-emerald-800 font-medium text-sm hover:bg-emerald-50 transition-colors shrink-0"
                >
                  Get in touch
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
