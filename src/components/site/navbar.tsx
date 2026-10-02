'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { Menu, X, Sun, Moon } from 'lucide-react'
import { useContentStore } from '@/store/content-store'
import { cn } from '@/lib/utils'

/**
 * Events, Training and Videos are deliberately absent: those sections have no
 * real coverage yet, so their content arrays are empty and the components
 * render nothing. A nav link to a section that isn't on the page is worse than
 * no link. Re-add the entry when real photos or footage are supplied.
 */
const navItems = [
  { label: 'Work', href: '/#work' },
  { label: 'Products', href: '/#products' },
  { label: 'Map', href: '/#map' },
  { label: 'Photos', href: '/#photos' },
  { label: 'About', href: '/#about' },
  { label: 'Founder', href: '/#founder' },
  { label: 'Contact', href: '/#contact' },
  { label: 'Order', href: '/order' },
  { label: 'Donations', href: '/donations' },
]

export function Navbar() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [scrolled, setScrolled] = React.useState(false)
  const store = useContentStore()
  const brand = store?.content?.brand ?? 'Basnayaka Vermigrow'
  const hasNotices = (store?.content?.notices?.length ?? 0) > 0 && !store?.tickerDismissed

  React.useEffect(() => { setMounted(true) }, [])

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        `fixed ${hasNotices ? 'top-11' : 'top-0'} inset-x-0 z-50 transition-all duration-500`,
        scrolled
          ? 'bg-background/80 backdrop-blur-xl border-b border-border/60'
          : 'bg-transparent'
      )}
    >
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* `/`, not `#top`: the `#top` anchor only exists in the home page hero,
            so on /order or /donations this link did nothing at all. */}
        <a href="/" className="flex items-center gap-2.5 group">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 backdrop-blur-sm shadow-sm overflow-hidden">
            <img
              src="/logos/logo-main.png"
              alt={`${brand} logo`}
              className="h-full w-full object-contain p-0.5"
            />
          </span>
          <span
            className={cn(
              'text-base sm:text-lg font-semibold tracking-tight transition-colors leading-tight',
              scrolled ? 'text-foreground' : 'text-white drop-shadow'
            )}
          >
            {brand}
          </span>
        </a>

        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                'px-3 py-2 text-sm font-medium rounded-md transition-colors',
                scrolled
                  ? 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              )}
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={cn(
              'inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full transition-colors touch-[manipulation]',
              !scrolled ? 'text-white hover:bg-white/10 active:bg-white/20' : 'text-foreground hover:bg-accent active:bg-accent'
            )}
          >
            {mounted ? (
              theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </button>
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className={cn(
              'md:hidden inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full transition-colors touch-[manipulation]',
              !scrolled ? 'text-white hover:bg-white/10 active:bg-white/20' : 'text-foreground hover:bg-accent active:bg-accent'
            )}
          >
            <Menu className="size-5" />
          </button>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden bg-background/95 backdrop-blur-xl flex flex-col">
          <div className="flex items-center justify-between h-16 px-4 shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 overflow-hidden">
                <img
                  src="/logos/logo-main.png"
                  alt={`${brand} logo`}
                  className="h-full w-full object-contain p-0.5"
                />
              </span>
              <span className="text-lg font-semibold">{brand}</span>
            </div>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center size-9 rounded-full text-foreground hover:bg-accent active:bg-accent touch-[manipulation]"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pt-6 flex flex-col gap-2">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-3 py-4 text-xl font-medium rounded-md hover:bg-accent active:bg-accent"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
