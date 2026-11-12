'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, MessageSquareText, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'

interface TemplateRow {
  key: string
  label: string
  when: string
  enabled: boolean
  body: string
}

interface SettingsResponse {
  templates: TemplateRow[]
  placeholders: string[]
}

/**
 * Per-event switches and wording for the customer outbox.
 *
 * A blank body means the built-in wording. An event switched off creates no
 * message row at all, so it costs nothing and cannot be sent later by "Send
 * all"; messages already in the outbox are untouched.
 */
export function SmsSettings() {
  const [rows, setRows] = useState<TemplateRow[] | null>(null)
  const [placeholders, setPlaceholders] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/admin/sms/settings')
        if (!res.ok) throw new Error('failed')
        const body: SettingsResponse = await res.json()
        if (!cancelled) {
          setRows(body.templates)
          setPlaceholders(body.placeholders)
        }
      } catch {
        if (!cancelled) toast.error('Could not load SMS settings')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const update = (key: string, patch: Partial<TemplateRow>) =>
    setRows((current) =>
      current ? current.map((r) => (r.key === key ? { ...r, ...patch } : r)) : current
    )

  const save = async () => {
    if (!rows) return
    setSaving(true)
    try {
      const templates = Object.fromEntries(
        rows.map((r) => [r.key, { enabled: r.enabled, body: r.body }])
      )
      const res = await fetch('/api/admin/sms/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(body?.error ?? 'Could not save SMS settings')
        return
      }
      toast.success('SMS settings saved')
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setRows((current) =>
      current
        ? current.map((r) => ({ ...r, enabled: true, body: '' }))
        : current
    )
    toast.info('Defaults restored — press Save to apply.')
  }

  if (!rows) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquareText className="size-4 text-emerald-600" />
          SMS messages
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Choose which events text the customer, and optionally replace the
          wording. A blank message uses the built-in text. Switching an event off
          creates no message at all; messages already queued are unaffected.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
          Placeholders:{' '}
          {placeholders.map((p) => (
            <code key={p} className="mr-1 rounded bg-background px-1 py-0.5">
              {p}
            </code>
          ))}
        </div>

        <div className="divide-y rounded-md border">
          {rows.map((r) => (
            <details key={r.key} className="group px-3 py-2">
              <summary className="flex cursor-pointer list-none items-center gap-3">
                <Switch
                  checked={r.enabled}
                  onCheckedChange={(checked) => update(r.key, { enabled: checked })}
                  aria-label={`Send ${r.label}`}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-medium ${r.enabled ? '' : 'text-muted-foreground'}`}
                  >
                    {r.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">{r.when}</span>
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {r.body.trim() ? 'custom text' : 'built-in text'}
                </span>
              </summary>
              <div className="mt-2 pl-12">
                <Textarea
                  value={r.body}
                  onChange={(e) => update(r.key, { body: e.target.value })}
                  placeholder="Leave blank to use the built-in wording."
                  maxLength={1000}
                  rows={3}
                  className="text-sm"
                  disabled={!r.enabled}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {r.body.length}/1000 characters
                </p>
              </div>
            </details>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save SMS settings
          </Button>
          <Button size="sm" variant="outline" onClick={reset} disabled={saving}>
            <RotateCcw className="size-4" /> Reset to defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
