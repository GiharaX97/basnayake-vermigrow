import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, LegalSection, LegalList } from '@/components/site/legal-page'

export const metadata: Metadata = {
  title: 'Privacy Policy — Basnayaka Vermigrow',
  description:
    'What personal information Basnayaka Vermigrow collects when you order, donate or contact us, why we collect it, who we share it with, and the rights you have under Sri Lankan data protection law.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy explains what personal information we collect when you use this website, order from us, donate, scan a pack or send us a message — and what we do with it."
    >
      <LegalSection title="1. Who is responsible for your information">
        <p>
          Basnayaka Vermigrow, Karandeniya, Galle District, Sri Lanka, is the
          controller of the personal information described here — we decide why and
          how it is used. Our contact details are at the bottom of this page. This
          policy is written to meet Sri Lanka&apos;s Personal Data Protection Act
          No. 9 of 2022.
        </p>
      </LegalSection>

      <LegalSection title="2. What we collect">
        <LegalList>
          <li>
            <strong>Orders:</strong> your name, phone number, email address (if you
            give one), any note you write — which may include a delivery address or
            instructions — the items and quantities you order, and the total amount.
          </li>
          <li>
            <strong>Donations:</strong> the name you choose to display, your phone
            number if you give one (only so we can thank you), the amount, and the
            pack code if you scanned a pack.
          </li>
          <li>
            <strong>Messages to us:</strong> the name, email address and message you
            submit through the contact form, or anything you send us by phone or SMS.
          </li>
          <li>
            <strong>Payments:</strong> the reference, amount, status and method of a
            payment, and — for card payments — limited details returned by
            Payments.lk such as the card scheme and last four digits.{' '}
            <strong>We never receive or store your full card number or CVV.</strong>
          </li>
          <li>
            <strong>Communications:</strong> records of the SMS messages we send you
            about an order or donation, including whether they were delivered, and
            any reply you send us.
          </li>
          <li>
            <strong>Technical information:</strong> standard web-server records such
            as your IP address, browser type and the pages requested, used for
            security and to keep the site working; and the cookies described in
            section 7.
          </li>
          <li>
            <strong>Public-wall content:</strong> the name and amount you submit for
            the donation wall, and the approximate date of the entry.
          </li>
        </LegalList>
        <p>
          We do not ask for, and do not want, sensitive information such as health
          details, religion or national identity numbers. Please do not send it to
          us.
        </p>
      </LegalSection>

      <LegalSection title="3. Why we use it">
        <LegalList>
          <li>
            <strong>To fulfil your order or booking:</strong> to confirm it, arrange
            delivery or collection, take payment, send your receipt and order
            updates, and handle any problem afterwards. This is necessary to perform
            our contract with you.
          </li>
          <li>
            <strong>To run donations and the donation wall:</strong> to record a
            contribution, attribute it to a pack, show the public entry you asked
            for, and send a thank-you. Displaying a name publicly happens because
            you chose to submit it.
          </li>
          <li>
            <strong>To answer you:</strong> to reply to an inquiry or message.
          </li>
          <li>
            <strong>To keep the site and our business safe:</strong> to prevent
            fraud and abuse, keep records, resolve disputes, enforce our terms and
            comply with the law. This is in our legitimate interest, balanced
            against your rights.
          </li>
          <li>
            <strong>With your consent, where we ask for it</strong> — for example if
            we ever ask to use your words or photographs in our publicity. You can
            withdraw consent at any time.
          </li>
        </LegalList>
        <p>
          We send order-related SMS only to the number you give us at checkout, and
          only about that order or donation. They are service messages — a
          confirmation, a receipt link, a delivery update — not marketing.
        </p>
        <p>
          We do not sell your personal information, and we do not send marketing
          messages to people who have not asked for them.
        </p>
      </LegalSection>

      <LegalSection title="4. The public donation wall">
        <p>
          The wall is public. If you submit a name, <strong>that name and the
          amount</strong> may be visible to anyone who visits the page. Your phone
          number is never shown there. Please do not submit a name you would not
          want strangers to see. You can ask us to remove or change an entry by
          contacting us; we will do so promptly.
        </p>
      </LegalSection>

      <LegalSection title="5. Who we share it with">
        <LegalList>
          <li>
            <strong>Payments.lk</strong>, operated by Payable — our payment
            provider, which processes card payments and tells us the result. For
            card data it acts as the payment processor; for everything else in
            this policy we remain the controller.
          </li>
          <li>
            <strong>Text.lk</strong> — our SMS provider, which delivers order and
            donation messages to the phone number you gave us.
          </li>
          <li>
            <strong>Our hosting and IT providers</strong> — who store the site and
            its database on our behalf.
          </li>
          <li>
            <strong>Professional advisers and authorities</strong> — where necessary
            to obtain advice, resolve a dispute, or comply with a legal obligation
            or a lawful request.
          </li>
        </LegalList>
        <p>
          Providers may only use the information to perform the service they provide
          to us. Some may process information outside Sri Lanka; where that happens,
          we take reasonable steps to ensure your information receives comparable
          protection.
        </p>
      </LegalSection>

      <LegalSection title="6. How long we keep it">
        <p>
          We keep order and payment records for as long as we need them for
          accounting, tax, warranty and dispute purposes — typically no longer than
          seven years. Contact-form messages are kept until the matter is resolved
          and for a reasonable period afterwards. Donation-wall entries stay while
          the wall is published unless you ask us to remove yours. SMS delivery
          records are kept only as long as needed to support the order they relate
          to. When information is no longer needed, we delete or anonymise it.
        </p>
      </LegalSection>

      <LegalSection title="7. Cookies">
        <p>
          This site uses only the cookies it needs to work. At present these are:
        </p>
        <LegalList>
          <li>
            <strong>A short-lived claim cookie</strong> set when you scan a pack QR
            code, so the name you add to the wall can be attributed to that pack. It
            expires quickly and is deleted once used.
          </li>
          <li>
            <strong>An admin session cookie</strong> for staff who sign in to manage
            the site. It is not set for ordinary visitors.
          </li>
          <li>
            <strong>An interface preference cookie</strong> remembering a display
            setting in the admin area.
          </li>
        </LegalList>
        <p>
          We do not currently use advertising or third-party analytics cookies. If
          that changes, we will update this policy first and, where the law
          requires, ask for your consent. You can block or delete cookies in your
          browser settings, but some parts of the site may then stop working.
        </p>
      </LegalSection>

      <LegalSection title="8. Keeping it secure">
        <p>
          The site is served over HTTPS, access to customer and order data is
          restricted to authorised staff, and card details never reach our servers.
          No system is perfectly secure, but we take reasonable technical and
          organisational steps to protect your information. If a breach occurs that
          is likely to affect you, we will notify you and the relevant authority as
          the law requires.
        </p>
      </LegalSection>

      <LegalSection title="9. Your rights">
        <p>Under the Personal Data Protection Act you have the right to:</p>
        <LegalList>
          <li>ask what personal information we hold about you and receive a copy;</li>
          <li>ask us to correct information that is wrong or incomplete;</li>
          <li>ask us to delete information we no longer have a lawful reason to keep;</li>
          <li>object to, or ask us to restrict, certain uses;</li>
          <li>withdraw a consent you gave us; and</li>
          <li>complain to the Data Protection Authority of Sri Lanka.</li>
        </LegalList>
        <p>
          To exercise a right, contact us using the details below. We may ask for
          proof of identity so we do not disclose your information to someone else.
          Some information must be kept for legal or accounting reasons even after a
          deletion request; we will explain if that applies.
        </p>
      </LegalSection>

      <LegalSection title="10. Children">
        <p>
          This site is intended for adults. Please do not place an order, make a
          donation or submit personal information if you are under 18. If you
          believe a child has given us personal information, contact us and we will
          delete it.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes to this policy">
        <p>
          We may update this policy as the site or the law changes. The version on
          this page, with the date shown above, is current. If a change materially
          affects how we use information we already hold, we will take reasonable
          steps to tell you.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          For any question about this policy or your information, use the details at
          the bottom of this page. Our <Link href="/terms">Terms &amp; Conditions</Link>{' '}
          and <Link href="/refunds">Refunds, Cancellations &amp; Delivery</Link>{' '}
          pages explain the related rules for orders.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
