'use client'

import * as React from 'react'
import { Calendar, MapPin, GraduationCap, PartyPopper } from 'lucide-react'
import { useContentStore } from '@/store/content-store'

export function NoticeBoard() {
  const { content } = useContentStore()
  const notices = content.notices || []

  const visible = notices

  if (notices.length === 0) return null

  return (
    <section id="notices" className="py-10 md:py-14 bg-gradient-to-b from-emerald-950 to-emerald-900 text-white scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            Notice Board
          </span>
          <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">
            Upcoming events & training
          </h2>
          <p className="mt-2 text-sm md:text-base text-emerald-100/80">
            Stay informed about our training programmes, workshops, farm events and community activities.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((notice) => (
            <div
              key={notice.id}
              className="group relative rounded-xl border border-emerald-800/50 bg-emerald-900/50 backdrop-blur-sm p-4 hover:bg-emerald-800/40 hover:border-emerald-600/50 transition-all duration-300"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  notice.type === 'training'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-rose-500/20 text-rose-300'
                }`}>
                  {notice.type === 'training' ? (
                    <GraduationCap className="h-3 w-3" />
                  ) : (
                    <PartyPopper className="h-3 w-3" />
                  )}
                  {notice.type === 'training' ? 'Training' : 'Event'}
                </span>
              </div>

              <h3 className="text-base font-semibold mb-1 group-hover:text-emerald-300 transition-colors">
                {notice.title}
              </h3>

              <p className="text-xs text-emerald-100/70 leading-relaxed line-clamp-2 mb-3">
                {notice.description}
              </p>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-emerald-300/80">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>{notice.date}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>{notice.location}</span>
                </div>
              </div>
            </div>
          ))}
        </div>


      </div>
    </section>
  )
}
