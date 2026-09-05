'use client'

import * as React from 'react'
import { Mail, Phone, MapPin, ArrowRight } from 'lucide-react'
import { useContentStore } from '@/store/content-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

export function Contact() {
  const { content } = useContentStore()
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [sending, setSending] = React.useState(false)

  // Read ?product= from URL on mount to pre-fill message
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const product = params.get('product')
    if (product) {
      setMessage(`Hi, I'm interested in ordering: ${product}\n\nPlease provide details on availability, pricing and delivery.`)
      // Scroll to contact
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !message) {
      toast.error('Please fill in all fields')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      })
      if (res.ok) {
        toast.success('Thanks! We will be in touch within 2 business days.')
        setName('')
        setEmail('')
        setMessage('')
        // Remove product param from URL
        const url = new URL(window.location.href)
        url.searchParams.delete('product')
        window.history.replaceState({}, '', url.toString())
      } else {
        toast.error('Failed to send message. Please try again.')
      }
    } catch {
      toast.error('Connection error')
    } finally {
      setSending(false)
    }
  }

  return (
    <section id="contact" className="py-20 md:py-28 bg-foreground text-background scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              Let&rsquo;s talk
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              Want to grow with us?
            </h2>
            <p className="mt-5 text-base md:text-lg text-background/70 max-w-md leading-relaxed">
              Whether you&rsquo;re a home gardener, a commercial farm, or a wholesale buyer, we&rsquo;d love to send you a sample of our vermicompost or talk about a regular supply. Send us a note and we&rsquo;ll reply within two business days.
            </p>

            <div className="mt-10 space-y-4">
              <a
                href={`mailto:${content.contactEmail}`}
                className="flex items-center gap-3 group"
              >
                <span className="h-10 w-10 rounded-full bg-background/10 group-hover:bg-emerald-500 flex items-center justify-center transition-colors">
                  <Mail className="h-4 w-4" />
                </span>
                <span className="text-background/90 group-hover:text-emerald-300 transition-colors">
                  {content.contactEmail}
                </span>
              </a>
              <a href={`tel:${content.contactPhone}`} className="flex items-center gap-3 group">
                <span className="h-10 w-10 rounded-full bg-background/10 group-hover:bg-emerald-500 flex items-center justify-center transition-colors">
                  <Phone className="h-4 w-4" />
                </span>
                <span className="text-background/90 group-hover:text-emerald-300 transition-colors">
                  {content.contactPhone}
                </span>
              </a>
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-full bg-background/10 flex items-center justify-center">
                  <MapPin className="h-4 w-4" />
                </span>
                <span className="text-background/90">{content.contactAddress}</span>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap gap-2">
              {content.socials.map((s) => (
                <a
                  key={s.id}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 min-h-[44px] rounded-full text-sm border border-background/20 hover:bg-background/10 transition-colors inline-flex items-center"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          <form
            onSubmit={onSubmit}
            className="rounded-2xl bg-background/5 backdrop-blur-sm border border-background/10 p-6 md:p-8 space-y-5"
          >
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-background/80 mb-2">
                Name
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="bg-background/5 border-background/20 text-background placeholder:text-background/40 focus-visible:ring-emerald-400 min-h-[48px]"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-background/80 mb-2">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="bg-background/5 border-background/20 text-background placeholder:text-background/40 focus-visible:ring-emerald-400 min-h-[48px]"
              />
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-background/80 mb-2">
                Project details
              </label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you need — vermicompost, vegetables, or a custom blend"
                rows={5}
                className="bg-background/5 border-background/20 text-background placeholder:text-background/40 focus-visible:ring-emerald-400 resize-none"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full rounded-full bg-emerald-500 hover:bg-emerald-600 text-white min-h-[52px] text-base"
            >
              {sending ? 'Sending...' : 'Send message'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </section>
  )
}
