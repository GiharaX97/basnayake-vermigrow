/**
 * Business facts quoted by the legal pages (/terms, /privacy, /refunds).
 *
 * Contact details are read from the CMS at render time, so an edit in
 * /admin/content reaches these pages the same way it reaches the footer. Only
 * facts the CMS does not model — and which a payment gateway's site review asks
 * for — live here.
 */

/** Shown at the top of every legal page, and in `<time dateTime>`. */
export const LEGAL_LAST_UPDATED_ISO = '2026-11-12'
export const LEGAL_LAST_UPDATED_LABEL = '12 November 2026'

/**
 * The registered company behind the brand. Shown next to the registration
 * number so the gateway reviewer can match the two.
 */
export const LEGAL_ENTITY_NAME = 'Basnayaka Vermigrow (Pvt) Ltd'

/**
 * Company number from the Certificate of Incorporation (Companies Act No. 7 of
 * 2007, incorporated 14 October 2025). `null` omits the line entirely rather
 * than shipping a visible "TODO".
 */
export const BUSINESS_REGISTRATION_NO: string | null = 'PV 00342856'

/**
 * Office landline, printed beside the mobile number on the legal pages. Kept
 * here rather than in the CMS because the CMS models one phone number only.
 */
export const OFFICE_PHONE = '0117 250 250'
