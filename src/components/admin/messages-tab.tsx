'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
// The labels live in message-meta.ts because the order detail page renders the
// same messages and must not name or colour them differently.
import { STATUS_LABELS, STATUS_STYLES, TEMPLATE_LABELS } from '@/components/admin/message-meta'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Ban,
  Check,
  Copy,
  ExternalLink,
  Mail,
  MessageSquare,
  Send,
  SkipForward,
} from 'lucide-react'

/**
 * The outbox — who we owe a message to, and whether they have had it.
 *
 * This answers both halves of "the customers and we should know what they did":
 * the customer gets the text, and this page is the list of who has still to
 * receive one. A queued badge is the mitigation for the fact that, with no
 * gateway connected, nothing sends itself.
 */

interface Message {
  id: string
  toName: string | null
  toPhone: string | null
  template: string
  body: string
  status: string
  sentAt: string | null
  sentBy: string | null
  error: string | null
  createdAt: string
  link: {
    id: string
    refType: string
    refId: string
    token: string
    expiresAt: string | null
    revokedAt: string | null
  }
}

/**
 * A reply the customer sent us. `orderRef` is set only when we could attach it to
 * one order; `error` carries why nothing was done when we could not (or when the
 * reply was understood but the order was not in a state to act on).
 */
interface InboundReply {
  id: string
  from: string | null
  body: string | null
  orderRef: string | null
  error: string | null
  createdAt: string
}

interface MessagesResponse {
  messages: Message[]
  queuedCount: number
  failedCount: number
  inbound: InboundReply[]
  transport: 'manual' | 'http'
  provider: {
    transport: 'manual' | 'http'
    provider: string
    requires: string[]
    missing: string[]
    ready: boolean
  }
  autoSend: {
    enabled: boolean
    cap: number
    sentToday: number
  }
}

/**
 * Opens the phone's own SMS app with the message prefilled.
 *
 * `?body=` is the widely-supported form; iOS wants `&body=` after the number.
 * The customer's number is already normalised by zod on the way in, but spaces
 * and brackets are stripped here anyway — several Android SMS apps fail to parse
 * a `sms:` URI containing them.
 */
function smsHref(phone: string, body: string): string {
  const digits = phone.replace(/[^\d+]/g, '')
  const sep = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) ? '&' : '?'
  return `sms:${digits}${sep}body=${encodeURIComponent(body)}`
}

export function MessagesTab() {
  const [data, setData] = useState<MessagesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [filter, setFilter] = useState<'queued' | 'all'>('queued')
  const [reloadKey, setReloadKey] = useState(0)

  const refresh = () => setReloadKey((k) => k + 1)

  // The async IIFE matters: calling the fetch directly in the effect body puts a
  // setState in the synchronous body, which `react-hooks/set-state-in-effect`
  // flags. This is the same shape as direct-donations-tab.tsx, and keeping it
  // means this file adds nothing to that lint baseline.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/messages')
        if (!res.ok) throw new Error('failed')
        const body: MessagesResponse = await res.json()
        if (!cancelled) setData(body)
      } catch {
        if (!cancelled) toast.error('Could not load messages')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const act = async (id: string, action: 'send' | 'skip' | 'revoke') => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/messages/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(body?.error ?? 'Could not complete that action')
        // A conflict means someone else already moved this row; reload so the
        // list stops showing a stale state the admin can keep retrying.
        if (res.status === 409) refresh()
        return
      }
      toast.success(
        action === 'send' ? 'Marked as sent' : action === 'skip' ? 'Skipped' : 'Receipt link revoked'
      )
      refresh()
    } catch {
      toast.error('Network error')
    } finally {
      setBusyId(null)
    }
  }

  /**
   * Send everything queued, 50 at a time. Confirmed first: this spends real
   * money, and it is the one button here that cannot be undone by tapping again.
   */
  const sendAll = async () => {
    const count = data?.queuedCount ?? 0
    if (
      !window.confirm(
        `Send ${Math.min(count, 50)} of ${count} queued message${count === 1 ? '' : 's'} now? This spends real SMS credit and cannot be undone.`
      )
    ) {
      return
    }
    setBulkBusy(true)
    try {
      const res = await fetch('/api/admin/messages', { method: 'POST' })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(body?.error ?? 'Could not send the queue')
        return
      }
      toast.success(
        `Sent ${body.sent}${body.failed ? `, ${body.failed} failed` : ''}` +
          (body.remaining ? ` — ${body.remaining} still queued` : '')
      )
      refresh()
    } catch {
      toast.error('Network error')
    } finally {
      setBulkBusy(false)
    }
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Message copied')
    } catch {
      toast.error('Could not copy — please select the text manually')
    }
  }

  if (loading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading messages…</p>
  }

  const messages = data?.messages ?? []
  const shown = filter === 'queued' ? messages.filter((m) => m.status === 'queued') : messages
  const transport = data?.transport ?? 'manual'
  const provider = data?.provider
  const autoSend = data?.autoSend

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Mail className="size-4 text-emerald-600" /> Waiting to be sent
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-amber-700 dark:text-amber-400">
            {data?.queuedCount ?? 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {transport === 'manual' ? (
              <>
                No SMS gateway is connected, so nothing sends itself. Copy the text, or open it in
                your phone&rsquo;s messaging app, then mark it sent.
              </>
            ) : (
              <>Tapping Send transmits the message immediately.</>
            )}
          </p>
          {/* What the admin needs in order to trust the number above: which
              gateway is in play, whether it is actually usable, and how much of
              today's automatic budget is gone. A missing credential is reported
              by NAME — the value is never sent to the browser. */}
          {provider && transport === 'http' && (
            <p className="text-xs text-muted-foreground mt-2">
              {provider.ready ? (
                <>
                  Sending through{' '}
                  <span className="font-medium text-foreground">{provider.provider}</span>.
                  {autoSend
                    ? autoSend.enabled
                      ? ` New sales are texted automatically — ${autoSend.sentToday} of ${autoSend.cap} used today.`
                      : ' Automatic sending is switched off (SMS_AUTOSEND).'
                    : null}
                </>
              ) : (
                <span className="text-destructive">
                  {provider.missing.length
                    ? `Gateway "${provider.provider}" is missing ${provider.missing.join(', ')} — sending will fail.`
                    : `Unknown gateway "${provider.provider}" — sending will fail.`}
                </span>
              )}
            </p>
          )}
          {(data?.failedCount ?? 0) > 0 && (
            <p className="text-xs text-destructive mt-2">
              {data?.failedCount} message{data?.failedCount === 1 ? '' : 's'} failed to send.
            </p>
          )}
        </CardContent>
      </Card>

      {/* What the customers said back. Replies that moved an order also appear on
          that order's own timeline; this panel exists for the ones that went
          nowhere — an unknown number, a number on two orders, or a text that was
          not a command — which have no order page to be seen on. A webhook that
          silently swallowed those would be worse than having none. Hidden when
          there is nothing to read, so it is never an empty box on the page. */}
      {(data?.inbound.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageSquare className="size-4 text-emerald-600" /> Replies from customers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(data?.inbound ?? []).map((r) => (
              <div key={r.id} className="border-l-2 border-muted pl-3 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{r.from ?? 'Unknown number'}</span>
                  <span>{format(new Date(r.createdAt), 'd MMM, HH:mm')}</span>
                  {r.orderRef ? (
                    <Link
                      href={`/admin/orders/${encodeURIComponent(r.orderRef)}`}
                      className="text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                      order {r.orderRef}
                    </Link>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400">
                      not matched to an order
                    </span>
                  )}
                </div>
                <p className="text-sm">&ldquo;{r.body ?? '(no text)'}&rdquo;</p>
                {r.error && <p className="text-xs text-muted-foreground">{r.error}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant={filter === 'queued' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('queued')}
        >
          To send {data?.queuedCount ? `(${data.queuedCount})` : ''}
        </Button>
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All messages
        </Button>
        {/* Only with a gateway: on the manual transport "send all" would mark the
            whole queue sent without transmitting anything. The API refuses it
            too — this just keeps the button from offering it. */}
        {transport === 'http' && (data?.queuedCount ?? 0) > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            disabled={bulkBusy}
            onClick={sendAll}
          >
            <Send className="size-4" />
            {bulkBusy ? 'Sending…' : 'Send all queued'}
          </Button>
        )}
      </div>

      {shown.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {filter === 'queued'
              ? 'Nothing waiting — everyone has been told.'
              : 'No messages yet. They appear here as orders, sales, gifts and pack scans happen.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map((m) => (
            <Card key={m.id} className={m.status === 'skipped' ? 'opacity-60' : undefined}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {TEMPLATE_LABELS[m.template] ?? m.template}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLES[m.status] ?? 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {STATUS_LABELS[m.status] ?? m.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(m.createdAt), 'd MMM yyyy, HH:mm')}
                  </span>
                  {m.link.revokedAt && (
                    <span className="text-xs font-medium text-destructive">Link revoked</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">
                    To:{' '}
                    <span className="text-foreground">
                      {m.toName ?? 'Unnamed'}
                      {m.toPhone ? (
                        <span className="font-mono"> · {m.toPhone}</span>
                      ) : (
                        <span className="text-destructive"> · no phone on file</span>
                      )}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    Reference: <span className="font-mono text-foreground">{m.link.refId}</span>
                  </span>
                </div>

                <p className="rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap break-words">
                  {m.body}
                </p>

                {m.error && <p className="text-xs text-destructive">{m.error}</p>}
                {m.sentAt && (
                  <p className="text-xs text-muted-foreground">
                    Sent {format(new Date(m.sentAt), 'd MMM yyyy, HH:mm')}
                    {m.sentBy === 'auto'
                      ? ' automatically'
                      : m.sentBy
                        ? ` by ${m.sentBy}`
                        : ''}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => copy(m.body)}>
                    <Copy className="size-4" /> Copy
                  </Button>
                  {m.toPhone && (
                    <Button size="sm" variant="outline" asChild>
                      {/* An <a>, not a fetch: this hands off to the phone's own
                          messaging app, which is what makes sending work today
                          at zero cost and with no provider. */}
                      <a href={smsHref(m.toPhone, m.body)}>
                        <MessageSquare className="size-4" /> Open SMS app
                      </a>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/r/${m.link.token}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" /> Preview receipt
                    </a>
                  </Button>
                  {m.status === 'queued' && (
                    <>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-500"
                        disabled={busyId === m.id || !m.toPhone}
                        onClick={() => act(m.id, 'send')}
                      >
                        {transport === 'http' ? (
                          <Send className="size-4" />
                        ) : (
                          <Check className="size-4" />
                        )}
                        {transport === 'http' ? 'Send' : 'Mark sent'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === m.id}
                        onClick={() => act(m.id, 'skip')}
                      >
                        <SkipForward className="size-4" /> Skip
                      </Button>
                    </>
                  )}
                  {!m.link.revokedAt && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={busyId === m.id}
                      onClick={() => act(m.id, 'revoke')}
                      title="Kill the receipt link if it leaked"
                    >
                      <Ban className="size-4" /> Revoke link
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
