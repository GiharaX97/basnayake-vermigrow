/**
 * The brand wordmark with a ™ superscript.
 *
 * The marks on this site are NOT registered with the National Intellectual
 * Property Office, so ™ (a claim of rights) is the only symbol that may be
 * used. ® is reserved for registered marks and using it on an unregistered one
 * is a false representation under the Intellectual Property Act No. 36 of 2003.
 * If a certificate is ever issued, this is the one place to change.
 *
 * Rendered as text rather than baked into the logo files: the PNG lockups have
 * the name in the image, and a superscript cannot be edited into them cleanly.
 * `aria-hidden` keeps screen readers from announcing "trademark" on every
 * mention.
 */
export function BrandMark({ brand, className }: { brand: string; className?: string }) {
  return (
    <span className={className}>
      {brand}
      <sup className="ml-0.5 align-super text-[0.62em] font-normal" aria-hidden="true">
        ™
      </sup>
    </span>
  )
}
