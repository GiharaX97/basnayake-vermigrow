/**
 * LKR formatting for the whole app.
 *
 * `Math.round` before formatting is deliberate: `maximumFractionDigits: 0`
 * already rounds, but keeping it makes the output byte-identical to the copy
 * this replaced in `donations-client.tsx` — the public donation wall's rendered
 * number must not shift because of a refactor.
 */
export function formatLkr(value: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 0,
  }).format(Math.round(value))
}
