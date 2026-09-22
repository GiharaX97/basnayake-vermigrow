import type { SiteContent } from './content-defaults'
import type { CatalogItem } from './catalog'

/**
 * JSON-LD builders.
 *
 * Every value is omitted when it is blank rather than emitted as `""` — an empty
 * string is a value to a validator, and Google reports errors on them. Nothing
 * here asserts a fact the CMS does not hold: a field with no data is absent from
 * the markup, it is never guessed.
 */

type JsonObject = Record<string, unknown>

/** Drops blank, null and empty-array entries so partial CMS data stays valid. */
function prune(input: JsonObject): JsonObject {
  const out: JsonObject = {}
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue
    if (typeof value === 'string' && value.trim() === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    out[key] = value
  }
  return out
}

/** Site-relative CMS paths (`/uploads/x.jpg`) need the origin to be absolute. */
function absolute(url: string | null | undefined, origin: string): string | undefined {
  if (!url) return undefined
  const value = url.trim()
  if (!value) return undefined
  if (/^https?:\/\//i.test(value)) return value
  return `${origin}${value.startsWith('/') ? '' : '/'}${value}`
}

/**
 * `LocalBusiness` + `WebSite` for the home page.
 *
 * The type is `LocalBusiness`, not `Farm` — schema.org defines no `Farm` type
 * (`https://schema.org/Farm` is a 404 and the type tree does not list it), and
 * Google states it does not support `additionalType`, so there is no way to be
 * more specific than this without inventing a type crawlers will ignore.
 */
export function buildSiteJsonLd(content: SiteContent, origin: string): JsonObject {
  const businessId = `${origin}/#business`
  const websiteId = `${origin}/#website`

  // The map section already carries coordinates; reuse the first location rather
  // than adding a duplicate field to the content model.
  const place = content.mapLocations?.[0]
  const geo =
    place && Number.isFinite(place.lat) && Number.isFinite(place.lng)
      ? { '@type': 'GeoCoordinates', latitude: place.lat, longitude: place.lng }
      : undefined

  const sameAs = (content.socials ?? [])
    .map((social) => absolute(social.url, origin))
    .filter((url): url is string => Boolean(url))

  const logo = absolute(content.ogImage || '/logos/logo-main.png', origin)

  const business = prune({
    '@type': 'LocalBusiness',
    '@id': businessId,
    name: content.brand,
    description: content.seoDescription?.trim() || content.tagline,
    url: origin,
    telephone: content.contactPhone,
    email: content.contactEmail,
    image: logo,
    logo,
    address: prune({
      '@type': 'PostalAddress',
      streetAddress: content.contactAddress,
      addressCountry: 'LK',
    }),
    geo,
    sameAs,
  })

  const website = prune({
    '@type': 'WebSite',
    '@id': websiteId,
    name: content.brand,
    url: origin,
    publisher: { '@id': businessId },
  })

  return { '@context': 'https://schema.org', '@graph': [business, website] }
}

/**
 * `Product` markup for the order page, wrapped in an `ItemList`.
 *
 * Restricted to priced items. A `price` of 0 is this app's "no price set yet"
 * sentinel (see `src/lib/catalog.ts`), and Google requires a real price — so an
 * unpriced item is left out rather than advertised at LKR 0, which would be a
 * false claim about the business. Returns null when nothing is priced.
 */
export function buildProductsJsonLd(
  items: CatalogItem[],
  origin: string
): JsonObject | null {
  const priced = items.filter((item) => item.orderable && item.price > 0)
  if (priced.length === 0) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: priced.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: prune({
        '@type': 'Product',
        name: item.name,
        description: item.description,
        image: absolute(item.imageUrl, origin),
        offers: {
          '@type': 'Offer',
          price: item.price,
          priceCurrency: 'LKR',
          url: `${origin}/order`,
          availability:
            item.remainingSeats === 0
              ? 'https://schema.org/SoldOut'
              : 'https://schema.org/InStock',
        },
      }),
    })),
  }
}

/**
 * Serialises for a `<script type="application/ld+json">`. Escaping `<` stops CMS
 * text containing `</script>` from closing the tag early and breaking out of it.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
