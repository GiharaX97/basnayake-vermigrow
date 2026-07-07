'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Sun, Moon, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useContentStore } from '@/store/content-store'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Work', href: '#work' },
  { label: 'Photos', href: '#photos' },
  { label: 'Videos', href: '#videos' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
]

export function Navbar() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [scrolled, setScrolled] = React.useState(false)
  const { content, editMode, toggleEditMode } = useContentStore()

  React.useEffect(() => setMounted(true), [])

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed top-0 inset-x-0 z-50 transition-all duration-500',
        scrolled
          ? 'bg-background/80 backdrop-blur-xl border-b border-border/60'
          : 'bg-transparent'
      )}
    >
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5 group">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 backdrop-blur-sm shadow-sm overflow-hidden">
            <img
              src="/logos/logo-main.png"
              alt={`${content.brand} logo`}
              className="h-full w-full object-contain p-0.5"
            />
          </span>
          <span
            className={cn(
              'text-base sm:text-lg font-semibold tracking-tight transition-colors leading-tight',
              scrolled ? 'text-foreground' : 'text-white drop-shadow'
            )}
          >
            {content.brand}
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
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle edit mode"
            onClick={toggleEditMode}
            className={cn(
              'rounded-full',
              editMode && 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
              !scrolled && !editMode && 'text-white hover:bg-white/10'
            )}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={cn('rounded-full', !scrolled && 'text-white hover:bg-white/10')}
          >
            {mounted ? (
              theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
            ) : (
              <span className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            className={cn('md:hidden rounded-full', !scrolled && 'text-white hover:bg-white/10')}
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 md:hidden bg-background/95 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between h-16 px-4">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 overflow-hidden">
                  <img
                    src="/logos/logo-main.png"
                    alt={`${content.brand} logo`}
                    className="h-full w-full object-contain p-0.5"
                  />
                </span>
                <span className="text-lg font-semibold">{content.brand}</span>
              </div>
              <Button variant="ghost" size="icon" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="px-4 pt-6 flex flex-col gap-2">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="px-3 py-3 text-xl font-medium rounded-md hover:bg-foreground/5"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
