import type { Prisma } from '@prisma/client'
import type { Template } from '@/lib/notify'

/**
 * Admin-editable SMS switches and wording.
 *
 * Stored under their own SiteContent key rather than inside the site-content
 * blob: these are operational settings, not marketing copy, and mixing them in
 * would mean every "Save content" from the page editor rewrites SMS behaviour.
 *
 * A template with no stored entry uses the code default and is enabled. That
 * makes "no row" the safe state: an empty or corrupt settings row can never
 * silence customer messages, because the fallback is the shipped behaviour.
 */

export const SMS_SETTINGS_KEY = 'sms:templates'

export interface TemplateSetting {
  /** false = no CustomerMessage row is created for this event. */
  enabled: boolean
  /** Custom body; empty string means "use the built-in wording". */
  body: string
}

export type SmsTemplateSettings = Partial<Record<Template, TemplateSetting>>

/** Every template, in the order the admin should see them. */
export const SMS_TEMPLATE_ORDER: Template[] = [
  'order_placed',
  'order_paid',
  'order_cancelled',
  'order_confirmed',
  'order_packed',
  'order_dispatched',
  'order_delivered',
  'order_cancel_requested',
  'sale_thanks',
  'scan_thanks',
  'gift_thanks',
]

export const SMS_TEMPLATE_LABELS: Record<Template, string> = {
  order_placed: 'Order placed',
  order_paid: 'Payment received',
  order_cancelled: 'Order cancelled',
  order_confirmed: 'Order confirmed',
  order_packed: 'Order packed',
  order_dispatched: 'Order sent to customer',
  order_delivered: 'Order delivered',
  order_cancel_requested: 'Cancel requested',
  sale_thanks: 'Sale thank-you',
  scan_thanks: 'Pack scan thank-you',
  gift_thanks: 'Donation thank-you',
}

export const SMS_TEMPLATE_WHEN: Record<Template, string> = {
  order_placed: 'When an order is placed online.',
  order_paid: 'When payment is recorded.',
  order_cancelled: 'When an order is cancelled.',
  order_confirmed: 'When the order is marked Confirmed.',
  order_packed: 'When the order is marked Packed.',
  order_dispatched: 'When the order is marked Sent to customer.',
  order_delivered: 'When the order is marked Delivered.',
  order_cancel_requested: 'When a customer asks to cancel a paid order.',
  sale_thanks: 'When an admin records a sale.',
  scan_thanks: 'When a buyer claims their pack on the wall.',
  gift_thanks: 'When a donation is recorded.',
}

/** Placeholders the admin may use in a custom body. */
export const SMS_TEMPLATE_PLACEHOLDERS = [
  '{greeting}',
  '{name}',
  '{orderRef}',
  '{total}',
  '{donation}',
  '{amount}',
  '{passes}',
  '{url}',
] as const

type SettingsClient = Prisma.TransactionClient

/** Read the settings; a missing or malformed row reads as "all defaults". */
export async function readSmsSettings(client: SettingsClient): Promise<SmsTemplateSettings> {
  try {
    const row = await client.siteContent.findUnique({
      where: { key: SMS_SETTINGS_KEY },
      select: { value: true },
    })
    if (!row) return {}
    const parsed: unknown = JSON.parse(row.value)
    if (!parsed || typeof parsed !== 'object') return {}

    const out: SmsTemplateSettings = {}
    for (const key of SMS_TEMPLATE_ORDER) {
      const raw = (parsed as Record<string, unknown>)[key]
      if (!raw || typeof raw !== 'object') continue
      const entry = raw as { enabled?: unknown; body?: unknown }
      out[key] = {
        enabled: entry.enabled !== false,
        body: typeof entry.body === 'string' ? entry.body.slice(0, 1000) : '',
      }
    }
    return out
  } catch {
    // A corrupt row must not stop a customer being texted.
    return {}
  }
}

/** Default is enabled: only an explicit `false` turns an event off. */
export function isTemplateEnabled(settings: SmsTemplateSettings, template: Template): boolean {
  return settings[template]?.enabled !== false
}

/** Custom body, or '' to use the built-in renderer. */
export function templateBody(settings: SmsTemplateSettings, template: Template): string {
  return settings[template]?.body?.trim() ?? ''
}
