import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, LegalSection, LegalList } from '@/components/site/legal-page'

export const metadata: Metadata = {
  title: 'Terms & Conditions — Basnayaka Vermigrow',
  description:
    'The terms that apply when you use the Basnayaka Vermigrow website, place an order, book a workshop seat, or make a donation.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      intro="These terms apply to this website and to every order, workshop booking and donation you make through it. Please read them before you place an order — placing an order means you accept them."
    >
      <LegalSection title="1. Who we are">
        <p>
          Basnayaka Vermigrow is the trading name of{' '}
          <strong>Basnayaka Vermigrow (Pvt) Ltd</strong>, company number{' '}
          <strong>PV 00342856</strong>, incorporated in Sri Lanka on 14 October
          2025. We are a family-run organic farm operating in Karandeniya, Galle
          District, Sri Lanka. We produce vermicompost and other organic
          fertiliser, grow organic vegetables, sell live worms, and run vermiculture
          workshops and training programmes. In these terms, &ldquo;we&rdquo;,
          &ldquo;us&rdquo; and &ldquo;our&rdquo; mean Basnayaka Vermigrow (Pvt) Ltd, and
          &ldquo;you&rdquo; means the person using this website.
        </p>
      </LegalSection>

      <LegalSection title="2. Using this website">
        <p>
          You may browse and order from this site for personal, household or
          business use that is lawful in Sri Lanka. You agree not to interfere with
          the site, attempt to gain unauthorised access to it or its data, copy it
          at scale, or use it to break the law or infringe anyone&apos;s rights. We
          may suspend or withdraw the site, or refuse service, where we reasonably
          believe it is being misused.
        </p>
        <p>
          Communications and records between us may be electronic. You agree that
          an order confirmation, receipt or notice we send by SMS, email or through
          this site is a valid record for the purposes of the Electronic
          Transactions Act No. 19 of 2006, and that you can rely on it as such.
        </p>
      </LegalSection>

      <LegalSection title="3. Our products">
        <p>
          Vermicompost, live worms and vegetables are natural products. Colour,
          texture, weight and appearance can vary between batches, and photographs
          on this site are illustrative rather than a precise description of the
          batch you receive. We describe our products as accurately as we can, but
          nothing on this site is professional agricultural, veterinary or medical
          advice — if your crop or soil has a specific problem, ask us or a
          qualified adviser before relying on a product.
        </p>
        <p>
          Availability changes with the season and with what the farm has ready.
          Listing a product on this site does not guarantee it is in stock; if we
          cannot supply something you ordered, we will tell you before confirming
          the order.
        </p>
        <p>
          We confirm that goods we sell match their description and are of
          merchantable quality and fit for the purpose for which goods of that kind
          are commonly bought, as required by Sri Lankan consumer law, including
          the Sale of Goods Ordinance and the Consumer Affairs Authority Act No. 9
          of 2003. If something we supply does not meet that standard, tell us and
          we will put it right under section 7.
        </p>
      </LegalSection>

      <LegalSection title="4. Placing an order">
        <LegalList>
          <li>
            Submitting the order form is a <strong>request to buy</strong>, not the
            finished contract. We will contact you — usually by phone or SMS — to
            confirm availability, delivery or collection, and payment.
          </li>
          <li>
            A contract is formed only when we confirm your order. Until then we may
            decline it, including where an item is out of stock, a price was listed
            in error, or we reasonably suspect fraud.
          </li>
          <li>
            You are responsible for giving us a correct name, phone number and
            email address, and for telling us about any delivery instructions. If
            we cannot reach you, we may have to cancel the order.
          </li>
          <li>
            You see a summary of the items, quantities and total before you confirm
            the order. Check it before you submit — that summary is what we act on.
          </li>
          <li>
            After you order we send you a receipt link. It shows the price, the
            payment method, the delivery terms and links to these terms and our
            privacy policy, and it is your record of the order.
          </li>
          <li>
            By giving us a phone number you agree to receive service messages about
            that order or donation — confirmation, receipt and delivery updates.
            These are not marketing messages.
          </li>
          <li>
            If we have taken any money for an order we then decline, we will refund
            it in full.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="5. Prices and payment">
        <p>
          Prices are shown in Sri Lankan Rupees (LKR) and include any VAT or other
          tax that applies to the sale. We try to keep them current, but if we
          discover a pricing error before confirming your order we will tell you
          the correct price and you may cancel.
        </p>
        <p>Depending on what is offered at the time, you can pay:</p>
        <LegalList>
          <li><strong>In cash</strong> at the store or on delivery;</li>
          <li><strong>By bank transfer</strong> to the account we give you; or</li>
          <li>
            <strong>By card</strong>, through the secure hosted checkout of our
            payment provider, <strong>Payments.lk</strong>, where card payment is
            available. Card details are entered on Payments.lk&apos;s page and are
            never entered on, or stored by, this website. We receive only the
            payment result and limited details such as the card scheme and the last
            four digits.
          </li>
        </LegalList>
        <p>
          Your bank or card issuer may charge its own fees or apply its own
          exchange rules; those are between you and them.
        </p>
      </LegalSection>

      <LegalSection title="6. Delivery and collection">
        <p>
          Delivery or collection is arranged with you when we confirm your order.
          Any delivery charge is quoted to you before you pay. Please inspect goods
          at handover and raise any problem with us promptly — our{' '}
          <Link href="/refunds">Refunds, Cancellations &amp; Delivery</Link> page
          explains how. Risk in the goods passes to you when they are delivered or
          collected.
        </p>
      </LegalSection>

      <LegalSection title="7. Cancellation and refunds">
        <p>
          You can cancel an order before it is dispatched. What we can do about
          damaged, incorrect or missing goods, workshop bookings and donations is
          set out on our <Link href="/refunds">Refunds, Cancellations &amp; Delivery</Link>{' '}
          page, which forms part of these terms. Nothing there limits any right you
          have under Sri Lankan consumer law.
        </p>
      </LegalSection>

      <LegalSection title="8. Donations">
        <p>
          Donations you add to an order, or make directly, are voluntary gifts to
          support the community fund described on this site — currently a
          contribution towards Apeksha Hospital. You receive no goods or services
          in return for a donation, and it is not a payment for any product.
        </p>
        <p>
          Donations are generally non-refundable. We will refund a donation where
          it was taken twice by mistake, where the payment itself was fraudulent or
          unauthorised, or where the law requires it. If you add your name to the
          public donation wall, your name and the amount may be displayed publicly
          as described in our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="9. Pack QR codes">
        <p>
          Packs may carry a QR code that lets the buyer scan it, see the donation
          programme, and optionally add a name to the public wall. A code is
          intended for the pack it was printed on and can be claimed only once.
          Codes have no cash value and may not be copied, resold or used to
          misrepresent a purchase. We may cancel a claim that we reasonably believe
          is fraudulent.
        </p>
      </LegalSection>

      <LegalSection title="10. Workshops and training">
        <p>
          Workshop and training seats are limited and are held only once your
          booking is confirmed. You must follow safety instructions given at the
          farm, and children must be accompanied by a responsible adult. If you
          need to cancel or reschedule, please give us as much notice as you can —
          the terms are on the <Link href="/refunds">refunds page</Link>. If we cancel
          a session, you may take a full refund or move to another date.
        </p>
      </LegalSection>

      <LegalSection title="11. Names and content you submit">
        <p>
          If you submit a name for the donation wall or send us a message, you
          confirm that the information is yours to give and that it is not
          unlawful, offensive, misleading or someone else&apos;s private
          information used without permission. We may shorten, edit or remove a
          submission that breaks this rule or that we reasonably consider
          inappropriate.
        </p>
      </LegalSection>

      <LegalSection title="12. Intellectual property">
        <p>
          The site&apos;s text, photographs, logo, layout and other content belong
          to us or are used with permission. You may view and print pages for your
          own use, but you may not copy, republish or use our content commercially
          without our written permission.
        </p>
      </LegalSection>

      <LegalSection title="13. Third-party services">
        <p>
          Payments are processed by Payments.lk, and messages may be sent through a
          third-party SMS provider. Those services have their own terms and privacy
          policies, and we are not responsible for their websites or their acts
          beyond what the law requires.
        </p>
      </LegalSection>

      <LegalSection title="14. Our liability">
        <p>
          Nothing in these terms excludes or limits liability that cannot be
          excluded or limited under Sri Lankan law — including liability for death
          or personal injury caused by our negligence, or for fraud.
        </p>
        <p>
          Subject to that: we do not guarantee that the site will always be
          available or free of errors; we are not liable for indirect or
          consequential loss (such as lost profit or lost crops) arising from use of
          the site or a product; and our total liability in connection with an
          order is limited to the amount you paid us for that order.
        </p>
        <p>
          We are not liable for delay or failure caused by events beyond our
          reasonable control, such as severe weather, floods, strikes, supplier
          failure or a failure of the payment network. If that happens we will tell
          you promptly and refund anything you have paid for goods we cannot
          supply.
        </p>
      </LegalSection>

      <LegalSection title="15. Governing law">
        <p>
          These terms are governed by the laws of Sri Lanka, and the courts of Sri
          Lanka have jurisdiction over any dispute. Before going to court, please
          contact us — most problems can be settled with a phone call.
        </p>
        <p>
          If we cannot resolve a complaint between us, you may refer it to the
          Consumer Affairs Authority of Sri Lanka. Nothing in these terms takes
          away a right you have under the Consumer Affairs Authority Act No. 9 of
          2003 or any other law.
        </p>
      </LegalSection>

      <LegalSection title="16. Changes to these terms">
        <p>
          We may update these terms from time to time. The version published on
          this page, with the date shown above, is the one that applies when you use
          the site. A change does not alter the terms of an order we have already
          confirmed.
        </p>
      </LegalSection>

      <LegalSection title="17. Contact">
        <p>
          Questions about these terms, or a problem with an order? Use the contact
          details at the bottom of this page, or the contact section on our home
          page. We will respond as soon as we reasonably can.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
