'use client'

import { useContentStore } from '@/store/content-store'

export function Footer() {
  const { content } = useContentStore()
  const year = new Date().getFullYear()
  return (
    <footer className="bg-background border-t border-border/60 mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white border border-border/60 overflow-hidden">
              <img
                src="/logos/logo-main.png"
                alt={`${content.brand} logo`}
                className="h-full w-full object-contain p-0.5"
              />
            </span>
            <div>
              <div className="text-base font-semibold">{content.brand}</div>
              <div className="text-xs text-muted-foreground">{content.tagline}</div>
            </div>
          </div>

          {/* Root-relative (`/#work`), not bare (`#work`). A bare fragment
              resolves against the current path, so on /order or /donations these
              all became /order#work and /donations#work — dead links on every
              page except the home page, which is where they were written. */}
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <a href="/#work" className="hover:text-foreground transition-colors">Work</a>
            <a href="/#products" className="hover:text-foreground transition-colors">Products</a>
            <a href="/#map" className="hover:text-foreground transition-colors">Map</a>
            <a href="/#photos" className="hover:text-foreground transition-colors">Photos</a>
            <a href="/#events" className="hover:text-foreground transition-colors">Events</a>
            <a href="/#training" className="hover:text-foreground transition-colors">Training</a>
            <a href="/#videos" className="hover:text-foreground transition-colors">Videos</a>
            <a href="/#about" className="hover:text-foreground transition-colors">About</a>
            <a href="/#founder" className="hover:text-foreground transition-colors">Founder</a>
            <a href="/#contact" className="hover:text-foreground transition-colors">Contact</a>
            <a href="/order" className="hover:text-foreground transition-colors">Order</a>
            <a href="/donations" className="hover:text-foreground transition-colors">Donations</a>
          </nav>

          <div className="text-xs text-muted-foreground">
            © {year} {content.brand}. Crafted with care.
          </div>
        </div>
      </div>
    </footer>
  )
}
