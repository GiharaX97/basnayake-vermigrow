import type { ReactNode } from 'react'
import { Navbar } from '@/components/site/navbar'
import { NoticeTicker } from '@/components/site/notice-ticker'
import { Footer } from '@/components/site/footer'
import { readSiteContent } from '@/lib/content-service'
import {
  BUSINESS_REGISTRATION_NO,
  LEGAL_ENTITY_NAME,
  LEGAL_LAST_UPDATED_ISO,
  LEGAL_LAST_UPDATED_LABEL,
  OFFICE_PHONE,
} from '@/lib/legal'

/**
 * Shared shell for the public legal pages.
 *
 * These are server components on purpose: the text must be in the HTML a
 * gateway reviewer, a search crawler or a customer with JavaScript disabled
 * sees. The only thing read from the database is the contact block, which is
 * CMS-owned and would otherwise go stale here.
 *
 * Not modelled in the CMS. Policy text is versioned in git so a change is a
 * reviewable diff rather than an anonymous edit — and the footer link, the
 * checkout consent line and the copy itself cannot drift apart.
 */
export async function LegalPage({
  title,
  intro,
  children,
}: {
  title: string
  intro: string
  children: ReactNode
}) {
  const content = await readSiteContent()
  const email = content.contactEmail?.trim() || 'basnayakavermigrow@gmail.com'
  const phone = content.contactPhone?.trim() || '+94 77 252 8685'
  const officePhone = content.contactPhoneAlt?.trim() || OFFICE_PHONE
  const address =
    content.contactAddress?.trim() ||
    'No 06, Basnayaka Vermigrow, Kekiriskanda, Karandeniya 80360, Sri Lanka'
  const brand = content.brand?.trim() || 'Basnayaka Vermigrow'

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NoticeTicker />
      <Navbar />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider">
              {brand}
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl font-bold tracking-tight max-w-2xl">
              {title}
            </h1>
            <p className="mt-4 text-base sm:text-lg text-emerald-100 max-w-2xl">
              {intro}
            </p>
          </div>
        </section>

        <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <p className="text-sm text-muted-foreground">
            Last updated{' '}
            <time dateTime={LEGAL_LAST_UPDATED_ISO}>{LEGAL_LAST_UPDATED_LABEL}</time>
          </p>

          <div className="mt-8 space-y-10">{children}</div>

          <section className="mt-14 rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold tracking-tight">Questions about this policy</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Write to us or call. We would rather sort something out directly than
              have you go away unhappy.
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex flex-col sm:flex-row sm:gap-2">
                <dt className="text-muted-foreground sm:w-24 shrink-0">Business</dt>
                <dd className="font-medium">{LEGAL_ENTITY_NAME}</dd>
              </div>
              {BUSINESS_REGISTRATION_NO && (
                <div className="flex flex-col sm:flex-row sm:gap-2">
                  <dt className="text-muted-foreground sm:w-24 shrink-0">Registration</dt>
                  <dd className="font-medium">{BUSINESS_REGISTRATION_NO}</dd>
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:gap-2">
                <dt className="text-muted-foreground sm:w-24 shrink-0">Address</dt>
                <dd className="font-medium">{address}</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-2">
                <dt className="text-muted-foreground sm:w-24 shrink-0">Email</dt>
                <dd>
                  <a
                    href={`mailto:${email}`}
                    className="font-medium underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                  >
                    {email}
                  </a>
                </dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-2">
                <dt className="text-muted-foreground sm:w-24 shrink-0">Phone</dt>
                <dd>
                  <a
                    href={`tel:${phone.replace(/[\s\-()]/g, '')}`}
                    className="font-medium underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                  >
                    {phone}
                  </a>
                </dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-2">
                <dt className="text-muted-foreground sm:w-24 shrink-0">Office</dt>
                <dd>
                  <a
                    href={`tel:${officePhone.replace(/[\s\-()]/g, '')}`}
                    className="font-medium underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                  >
                    {officePhone}
                  </a>
                </dd>
              </div>
            </dl>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  )
}

/** A numbered top-level heading with body copy. */
export function LegalSection({
  id,
  title,
  children,
}: {
  id?: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-sm sm:text-base leading-relaxed text-muted-foreground [&_strong]:text-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4">
        {children}
      </div>
    </section>
  )
}

/** A bulleted list that matches the surrounding body copy. */
export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-5 space-y-1.5">{children}</ul>
}
