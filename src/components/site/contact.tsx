'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
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

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !message) {
      toast.error('Please fill in all fields')
      return
    }
    toast.success('Thanks! We will be in touch within 2 business days.')
    setName('')
    setEmail('')
    setMessage('')
  }

  return (
    <section id="contact" className="py-20 md:py-28 bg-foreground text-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
              Let&rsquo;s talk
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              Have a story to grow?
            </h2>
            <p className="mt-5 text-base md:text-lg text-background/70 max-w-md leading-relaxed">
              Whether it&rsquo;s a film, a brand refresh, or a long-form documentary, we&rsquo;d love to hear what you&rsquo;re working on. Send a note and we&rsquo;ll be in touch within two business days.
            </p>

            <div className="mt-10 space-y-4">
              <a
                href={`mailto:${content.contactEmail}`}
                className="flex items-center gap-3 group"
              >
                <span className="h-10 w-10 rounded-full bg-background/10 group-hover:bg-amber-500 flex items-center justify-center transition-colors">
                  <Mail className="h-4 w-4" />
                </span>
                <span className="text-background/90 group-hover:text-amber-300 transition-colors">
                  {content.contactEmail}
                </span>
              </a>
              <a href={`tel:${content.contactPhone}`} className="flex items-center gap-3 group">
                <span className="h-10 w-10 rounded-full bg-background/10 group-hover:bg-amber-500 flex items-center justify-center transition-colors">
                  <Phone className="h-4 w-4" />
                </span>
                <span className="text-background/90 group-hover:text-amber-300 transition-colors">
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
                  className="px-4 py-2 rounded-full text-sm border border-background/20 hover:bg-background/10 transition-colors"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </motion.div>

          <motion.form
            onSubmit={onSubmit}
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.1 }}
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
                className="bg-background/5 border-background/20 text-background placeholder:text-background/40 focus-visible:ring-amber-400"
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
                className="bg-background/5 border-background/20 text-background placeholder:text-background/40 focus-visible:ring-amber-400"
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
                placeholder="Tell us about your project, timeline, and budget range"
                rows={5}
                className="bg-background/5 border-background/20 text-background placeholder:text-background/40 focus-visible:ring-amber-400 resize-none"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full rounded-full bg-amber-500 hover:bg-amber-600 text-black"
            >
              Send message
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.form>
        </div>
      </div>
    </section>
  )
}
