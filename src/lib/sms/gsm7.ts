/**
 * Force a text into the GSM-7 alphabet, so an SMS is billed as what it reads.
 *
 * WHY THIS EXISTS. A body is encoded either as GSM-7 — 160 characters in one
 * segment, 153 per segment once it splits — or as UCS-2, at 70 and 67. The
 * choice is made per message and it is absolute: ONE character outside GSM-7
 * flips the WHOLE body to UCS-2 and more than halves the room in every segment.
 * There is no "mostly GSM-7", and no warning when it happens.
 *
 * That is not hypothetical here. `formatLkr` formats with
 * Intl.NumberFormat('en-LK', { currency: 'LKR' }), and ICU separates the
 * currency from the figure with U+00A0 NO-BREAK SPACE — a character that renders
 * exactly like an ordinary space and is not in GSM-7. So every message naming an
 * amount, which is every order message, was being sent as UCS-2. Measured
 * against Text.lk on 2026-10-04: a 173-character order confirmation was billed
 * as 3 segments where GSM-7 needs 2, and a 259-character payment confirmation as
 * 4 where GSM-7 needs 2.
 *
 * The fix belongs HERE, at the SMS boundary, rather than in currency.ts, for two
 * reasons. U+00A0 does real work in HTML — it is what keeps "LKR" and the figure
 * from wrapping apart on the donation wall — and currency.ts documents that its
 * output must stay byte-identical for that wall. And the same trap waits in the
 * data: a customer who types a curly apostrophe into their name, or an em dash
 * into a note, would otherwise poison the encoding of their own confirmation,
 * with nothing on screen to explain the bill.
 *
 * Transliteration, not deletion: dropping U+00A0 outright would silently rewrite
 * "LKR 1,500" as "LKR1,500" in a message a customer reads.
 */

/**
 * Characters outside GSM-7 that have an obvious GSM-7 equivalent.
 *
 * The whitespace entries are the ones that actually fire today. The quote and
 * dash entries are guard rails against customer-supplied text, and the
 * zero-width entries are deleted rather than replaced — they are invisible, so
 * nothing a reader sees is lost.
 */
const SUBSTITUTIONS: Record<string, string> = {
  ' ': ' ', // no-break space  — ICU's LKR separator, the one that fires
  ' ': ' ', // narrow no-break space
  ' ': ' ', // figure space
  ' ': ' ', // thin space
  ' ': ' ', // hair space
  '\t': ' ',
  '‘': "'", // curly single quotes
  '’': "'",
  '‚': ',',
  '“': '"', // curly double quotes
  '”': '"',
  '–': '-', // en dash
  '—': '-', // em dash
  '…': '...', // ellipsis
  '•': '*', // bullet
  '·': '*', // middle dot
  '‹': '<',
  '›': '>',
  '«': '"',
  '»': '"',
  '​': '', // zero-width space
  '‌': '', // zero-width non-joiner
  '‍': '', // zero-width joiner
  '﻿': '', // byte-order mark
}

/** The GSM 03.38 default alphabet. `\n` and `\r` are genuinely in it. */
const GSM7_BASIC = new Set([
  ...`@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà`,
])

/**
 * The extension table: legal GSM-7, but each character costs TWO.
 *
 * Worth knowing because it is the other way a body quietly grows — a bracket or
 * a pipe is not free, and a name like "[LOCAL TEST] VermiGrow" pays 4 units for
 * its brackets alone.
 */
const GSM7_EXTENDED = new Set([...'^{}[~]|€'])

/** True when every character is in GSM-7, so the body encodes as GSM-7. */
export function isGsm7(text: string): boolean {
  for (const ch of text) if (!GSM7_BASIC.has(ch) && !GSM7_EXTENDED.has(ch)) return false
  return true
}

/** Transliterate anything outside GSM-7 into it. Unmappable characters become '?'. */
export function toGsm7(text: string): string {
  let out = ''
  for (const ch of text) {
    const mapped = SUBSTITUTIONS[ch]
    if (mapped !== undefined) {
      out += mapped
    } else {
      // '?' rather than nothing: an unmappable character is a bug worth seeing
      // in the message, and silently eating it could corrupt a URL or a name.
      out += GSM7_BASIC.has(ch) || GSM7_EXTENDED.has(ch) ? ch : '?'
    }
  }
  return out
}

/**
 * How many SMS segments a body occupies once sanitised.
 *
 * Mirrors the carrier's own arithmetic: 160 units for a single segment, 153 per
 * segment once it splits (the header eats 7), with extension characters counted
 * at double. Returns 0 for an empty body.
 */
export function gsm7Segments(text: string): number {
  const safe = toGsm7(text)
  let units = 0
  for (const ch of safe) units += GSM7_EXTENDED.has(ch) ? 2 : 1
  if (units === 0) return 0
  return units <= 160 ? 1 : Math.ceil(units / 153)
}
