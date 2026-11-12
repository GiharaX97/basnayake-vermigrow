'use client'

import { Heart } from 'lucide-react'
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
              {/* Seller identity and contact on every page: the e-commerce
                  directions (Gazette No. 2332/15) and the payment gateway's
                  merchant terms both expect a customer to be able to see who
                  they are buying from before they pay. */}
              <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                <div>{content.contactAddress}</div>
                <div>
                  <a href={`mailto:${content.contactEmail}`} className="hover:text-foreground transition-colors">
                    {content.contactEmail}
                  </a>
                  <span className="mx-1.5 text-border">·</span>
                  <a
                    href={`tel:${content.contactPhone.replace(/[\s\-()]/g, '')}`}
                    className="hover:text-foreground transition-colors"
                  >
                    {content.contactPhone}
                  </a>
                  {content.contactPhoneAlt && (
                    <>
                      <span className="mx-1.5 text-border">·</span>
                      <a
                        href={`tel:${content.contactPhoneAlt.replace(/[\s\-()]/g, '')}`}
                        className="hover:text-foreground transition-colors"
                      >
                        {content.contactPhoneAlt}
                      </a>
                    </>
                  )}
                </div>
              </div>
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
            <a href="/#about" className="hover:text-foreground transition-colors">About</a>
            <a href="/#founder" className="hover:text-foreground transition-colors">Founder</a>
            <a href="/#contact" className="hover:text-foreground transition-colors">Contact</a>
            <a href="/order" className="hover:text-foreground transition-colors">Order</a>
            <a href="/donations" className="hover:text-foreground transition-colors">Donations</a>
          </nav>
        </div>

        {/* Events, Training and Videos were dropped from the list above for the
            same reason as the navbar's: those sections are empty until real
            photos and footage exist, and a fragment link to a section that isn't
            on the page scrolls nowhere. */}
        <div className="mt-8 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>
            © {year} {content.brand}. Crafted with care.
          </div>
          {/* Required by the payment gateway's site review, and genuinely useful:
              a visitor must be able to reach the terms before paying. Kept out of
              the main nav so it does not crowd the product links. */}
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <a href="/donations#donate-only" className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-amber-500/30 transition-all hover:scale-105 hover:shadow-lg hover:shadow-rose-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 motion-reduce:transform-none">
              <Heart className="size-4 fill-current transition-transform group-hover:scale-110 motion-reduce:transform-none" />
              Donate
            </a>
            <a href="/terms" className="hover:text-foreground transition-colors">Terms &amp; Conditions</a>
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="/refunds" className="hover:text-foreground transition-colors">Refunds &amp; Delivery</a>
          </nav>
          <div>
            Developed by{' '}
            <span className="font-medium text-foreground">Gihara Wijesinghe</span>
            <span className="mx-1.5 text-border">·</span>
            <a
              href="tel:+94773259724"
              className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              +94 77 325 9724
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
