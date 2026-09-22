import { randomInt } from 'crypto'

// Unambiguous alphabet: no 0/O/1/I so codes stay readable when handwritten,
// dictated over the phone, or read off a damaged sticker.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const PACK_CODE_REGEX = /^VG-[A-HJ-NP-Z2-9]{6}$/

export function generatePackCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)]
  }
  return `VG-${code}`
}

/**
 * Generate `count` codes unique within the batch. Collision with codes already
 * in the DB is handled by the caller via the @unique constraint (probability
 * is negligible: 32^6 ≈ 1B combinations).
 */
export function generatePackCodes(count: number): string[] {
  const set = new Set<string>()
  while (set.size < count) {
    set.add(generatePackCode())
  }
  return [...set]
}
