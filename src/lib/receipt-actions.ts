'use server'

import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { clientIp, createThrottle } from '@/lib/throttle'

/**
 * The second half of the receipt gate: hand over the workshop voucher codes.
 *
 * WHY THIS IS AN ACTION AND NOT A ROUTE. The codes must not be in the page's
 * HTML. Gating them with client-side state would leave them in the source of a
 * URL that travels through SMS, chat apps and mail scanners — one "view source"
 * or one link-preview bot away from disclosure. A Server Action is a POST keyed
 * by an action id rather than by a path, so there is no enumerable endpoint to
 * walk and no cached GET that returns them. It also keeps the promise in
 * CODEBASE-TREE.md that nothing new is added to the public API surface.
 *
 * WHAT THE REFERENCE CHECK ACTUALLY BUYS, stated honestly: it stops automated
 * fetchers (iOS/WhatsApp link previews request every URL they see, and a preview
 * bot that landed on a receipt would otherwise burn the seats), and it stops
 * casual disclosure by someone glancing at a shared screen. It does NOT stop a
 * deliberate forwarder — anyone who has both messages has both factors. The
 * genuine protection for that case is revocation (`CustomerLink.revokedAt`),
 * which the admin can set without invalidating anything the customer holds.
 */

/**
 * 8 attempts per 15 minutes. The reference is 6 characters from a 32-character
 * alphabet (~1.07e9), so guessing is already hopeless; this bounds the work a
 * caller can make the server do, and is the reason an attacker cannot use this
 * action as a free oracle against the token space either.
 */
const revealThrottle = createThrottle({ windowMs: 15 * 60 * 1000, max: 8 })

export interface RevealedVoucher {
  code: string
  holderName: string | null
  redeemed: boolean
}

export type RevealResult =
  | { ok: true; vouchers: RevealedVoucher[] }
  | { ok: false; error: string }

export async function revealVouchers(token: string, reference: string): Promise<RevealResult> {
  const h = await headers()
  if (revealThrottle.check(clientIp(new Request('http://receipt.local', { headers: h })))) {
    return { ok: false, error: 'Too many attempts. Please try again in a few minutes.' }
  }

  // The token is the capability; never trust it from the client without
  // re-checking it is still live. The page checked a moment ago, but this is a
  // separate entry point and a revocation must take effect immediately.
  const link = await prisma.customerLink.findUnique({ where: { token } })
  if (
    !link ||
    link.revokedAt ||
    (link.expiresAt && link.expiresAt.getTime() <= Date.now()) ||
    link.refType !== 'order'
  ) {
    // Same message for every failure. Distinguishing "expired" from "no such
    // receipt" would confirm to a guesser that a token exists.
    return { ok: false, error: 'We could not open this receipt.' }
  }

  // The REFERENCE is normalised; the TOKEN never is. The stored order reference
  // is uppercase by construction (generateOrderRef) and a customer typing it in
  // lowercase is the normal case, so folding it is help, not laxity. The token is
  // base64url and folding it would break every link containing an uppercase
  // character — see the warning on generateReceiptToken.
  const entered = reference.replace(/\s+/g, '').toUpperCase()
  if (entered !== link.refId.toUpperCase()) {
    return { ok: false, error: 'That reference does not match this receipt.' }
  }

  // Every Pack carrying this orderRef is a workshop voucher: online orders mint
  // no packs for physical goods (the Sale line carries those), and the settle
  // route is the only writer of Pack.orderRef.
  const packs = await prisma.pack.findMany({
    where: { orderRef: link.refId },
    select: { code: true, holderName: true, status: true },
    orderBy: { code: 'asc' },
  })

  return {
    ok: true,
    vouchers: packs.map((p) => ({
      code: p.code,
      holderName: p.holderName,
      redeemed: p.status === 'redeemed',
    })),
  }
}
