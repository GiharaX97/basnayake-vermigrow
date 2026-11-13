import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, LegalSection, LegalList } from '@/components/site/legal-page'

export const metadata: Metadata = {
  title: 'Refunds, Cancellations & Delivery | Basnayaka Vermigrow',
  description:
    'How delivery and collection work at Basnayaka Vermigrow, when you can cancel an order or workshop booking, and how refunds are paid, including card refunds through Payments.lk.',
  alternates: { canonical: '/refunds' },
}

export default function RefundsPage() {
  return (
    <LegalPage
      title="Refunds, Cancellations & Delivery"
      intro="How we deliver orders, when you can cancel, and what happens if something is wrong. This page forms part of our Terms & Conditions."
    >
      <LegalSection title="1. Delivery and collection">
        <p>
          We arrange delivery or collection with you when we confirm your order. We
          will tell you the expected date and any delivery charge <strong>before you
          pay</strong>. If the charge is not acceptable, you can cancel at no cost.
        </p>
        <LegalList>
          <li>
            <strong>Local delivery</strong> is made to the address you give us in the
            order note or by phone. Please give a complete address and a phone number
            someone will answer on the delivery day.
          </li>
          <li>
            <strong>Collection</strong> is from the farm during the hours we agree
            with you.
          </li>
          <li>
            Please inspect the goods when they arrive or when you collect them. If
            you cannot take delivery, tell us as soon as possible so we can rearrange
            it; a repeated failed delivery may mean we have to cancel the order.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="2. Cancelling before dispatch">
        <p>
          You can cancel an order at any time before it is dispatched, at no charge,
          by calling or emailing us with your order reference. If you have already
          paid, we will refund the full amount by the original payment method.
          Once an order has been dispatched, a cancellation may be treated as a
          return, and collection or delivery costs may apply.
        </p>
        <p>
          This cancellation right is separate from returns for faulty goods. If you
          simply change your mind after delivery, contact us. Where the goods are
          unopened, unused and in a condition we can resell, we may agree to a
          return, but we do not promise a refund for change of mind. Nothing in
          this paragraph affects your statutory rights.
        </p>
      </LegalSection>

      <LegalSection title="3. Damaged, incorrect or missing goods">
        <p>
          If what arrives is damaged, not what you ordered, or short, contact us{' '}
          <strong>within 48 hours of delivery or collection</strong> with your order
          reference and, where possible, a photograph. We will replace the item or
          refund it, whichever you prefer, and we will cover the cost of putting
          it right. Please keep the goods and packaging until we have sorted it out.
        </p>
        <p>
          This does not affect any stronger right you have under Sri Lankan consumer
          law.
        </p>
      </LegalSection>

      <LegalSection title="4. Live worms">
        <p>
          Live worms are perishable. If they arrive dead or clearly unhealthy,
          contact us <strong>within 24 hours of delivery or collection</strong> and
          send a photograph if you can. We will replace them or refund them. Delays
          caused by the courier or by a delivery being left in unsuitable conditions
          after handover are outside our control, but tell us anyway. We would
          rather help than argue.
        </p>
      </LegalSection>

      <LegalSection title="5. Workshop and training bookings">
        <LegalList>
          <li>
            Cancel <strong>at least 48 hours before the session</strong> and you may
            take a full refund or move your seat to another date.
          </li>
          <li>
            With less than 48 hours&apos; notice, or if you do not attend, we may
            offer a credit towards a later session instead of a refund, because the
            seat could no longer be offered to anyone else.
          </li>
          <li>
            If <strong>we</strong> cancel or move a session, you may take a full
            refund or move to another date, whichever you prefer.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="6. Donations">
        <p>
          Donations are voluntary gifts and are generally non-refundable, because
          they are passed to the community fund rather than held as payment for
          goods. We will refund a donation where the same donation was taken twice
          by mistake, where the payment was unauthorised or fraudulent, or where the
          law requires it. Please contact us promptly if you think any of these
          applies.
        </p>
      </LegalSection>

      <LegalSection title="7. How refunds are paid">
        <LegalList>
          <li>
            <strong>Card payments</strong> are refunded through Payments.lk back to
            the card that was used. The refund is submitted promptly, but it
            typically takes <strong>5 to 10 business days</strong> to appear on your
            statement. The exact timing is set by your bank, not by us.
          </li>
          <li>
            <strong>Cash payments</strong> are refunded in cash at the store, or by
            bank transfer if that is more convenient for you.
          </li>
          <li>
            <strong>Bank transfers</strong> are refunded to the account the money
            came from, normally within 7 business days of the refund being agreed.
          </li>
        </LegalList>
        <p>
          We cannot refund more than the amount actually paid for the item, and we
          cannot refund a card payment to a different card or account.
        </p>
      </LegalSection>

      <LegalSection title="8. If you paid by card and dispute the charge">
        <p>
          Please contact us first. If a charge looks wrong we can usually trace it
          and fix it more quickly than a bank dispute. If we cannot resolve it, you
          remain free to raise the matter with your card issuer.
        </p>
      </LegalSection>

      <LegalSection title="9. How to ask for a cancellation or refund">
        <p>
          Call or email us using the details at the bottom of this page and include:
        </p>
        <LegalList>
          <li>your order reference (it starts with the order you placed and is on
            your receipt);</li>
          <li>your name and the phone number you ordered with;</li>
          <li>what went wrong, and a photograph where that helps.</li>
        </LegalList>
        <p>
          We aim to acknowledge every request within two business days.
        </p>
      </LegalSection>

      <LegalSection title="10. Your statutory rights">
        <p>
          Nothing on this page is intended to limit any right you have under Sri
          Lankan consumer law. Where the law gives you a stronger right than this
          policy, the law applies. See also our{' '}
          <Link href="/terms">Terms &amp; Conditions</Link> and{' '}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
