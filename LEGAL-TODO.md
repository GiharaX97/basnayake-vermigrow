# Legal pages — 5 facts to collect from the client

Status: **answered 2026-11-12** · pages published the same day. Delivery fee/window, returns
preference and VAT remain open questions in items 3–5; current wording stays defensible.

The pages (`/terms`, `/privacy`, `/refunds`) are built and render. They are safe to
*show* the client, but **items 1 and 2 must be filled before this goes live and
before we reply to Payments.lk** — the gateway reviewer will open the site.

| # | Ask the client | Lands in |
|---|---|---|
| 1 | Registered business name + business registration number (if any) | `src/lib/legal.ts` |
| 2 | Official phone, email and full postal address | `/admin/content` (CMS) |
| 3 | Delivery areas, working-day window, fee, collection hours | `/refunds` + `/terms` + receipt |
| 4 | Change-of-mind returns: accept 7-day unopened returns? | `/refunds` §2 |
| 5 | VAT registered? If yes, VAT number | `/terms` §5 + receipt |

---

## 1. Business registration

**Question to client:** "What is the registered business name, and do you have a
business registration number? (Divisional Secretariat registration, or a
Companies Act registration.)"

- If yes → set `BUSINESS_REGISTRATION_NO` in `src/lib/legal.ts:21` to the number
  as a string. It then appears in the contact block on all three pages.
- If no → leave `null` (the line is omitted). But flag to the client that a
  merchant account generally needs a registered business — Payments.lk KYC will
  ask. This is the biggest onboarding risk.

## 2. Official contact details

**Question to client:** "Which phone number, email address and full postal
address should be the official contact for orders and complaints?"

- Edit them in **Admin → Content** (`contactPhone`, `contactEmail`,
  `contactAddress`). The footer and all three legal pages read the CMS, so one
  edit fixes every surface.
- Current values are placeholders: `+94 77 123 4567`, `hello@basnayakavermigrow.lk`,
  "Karandeniya, Galle District, Southern Province". Confirm on the live site too
  — production content may differ from the local defaults.
- Once set, re-check: footer, `/terms`, `/privacy`, `/refunds`, and the receipt
  contact block all show the same value.

## 3. Delivery terms

**Question to client:** "Which areas do you deliver to? How many working days
after confirmation? What is the delivery fee? Where and when can customers
collect?"

Needed because Gazette No. 2332/15 requires delivery terms on the receipt, and
ours currently say only "arranged when we confirm" — defensible, but vague.

- Update `/refunds` §1 with the real area/window/fee.
- Mirror the same sentence in the receipt footer in
  `src/app/r/[token]/page.tsx` (currently: "Any delivery charge is quoted before payment").
- Keep `/terms` §6 consistent.

## 4. Change of mind / cooling-off

**Question to client:** "If a customer changes their mind after delivery, should
we accept a return within 7 days, provided the goods are unopened and resaleable?"

- Current policy: cancellation before dispatch is free; after delivery, returns
  only for damaged/incorrect goods; change-of-mind returns are at our discretion.
- The Gazette refers to "cooling-off periods and right of cancellation" but the
  law-firm summary does not fix a period, and Abans offers no change-of-mind
  returns at all. Current wording is defensible.
- If the client says yes → replace the final paragraph of `/refunds` §2 with an
  explicit 7-day unopened-return promise (and decide who pays return delivery).
- If no → leave as drafted.

## 5. VAT status

**Question to client:** "Is the business registered for VAT? If yes, what is the
VAT number?"

- Threshold: LKR 60 million/year or LKR 15 million/quarter (confirmed for 2026).
- If **not registered** → current wording ("prices include any VAT or other tax
  that applies") stays correct. Nothing to change.
- If **registered** → add the VAT number to the contact block in
  `src/components/site/legal-page.tsx`, and add a VAT breakdown line to the
  receipt (`/r/<token>`) and to `/terms` §5. Do not ship until the breakdown is
  accurate — a wrong VAT line is worse than none.

---

## Done 2026-11-12

The pages are live (commit `9705131`): footer legal nav, order-form consent line,
contact-form privacy line, receipt delivery/policy links and sitemap URLs are all
in place, and the live CMS holds the real contact details. Business identity:
Basnayaka Vermigrow (Pvt) Ltd, PV 00342856 (incorporated 14 October 2025).
Contact: basnayakavermigrow@gmail.com, +94 77 252 8685, office 0117 250 250,
No 06, Basnayaka Vermigrow, Kekiriskanda, Karandeniya 80360, Sri Lanka;
Facebook https://www.facebook.com/BasnayakaVermigrow/.

## Still open

1. Delivery areas, working-day window, fee and collection hours — answer 3 above.
2. Change-of-mind returns — answer 4 above.
3. VAT registration and number — answer 5 above.
4. Payments.lk: test key pair + webhook secret, sandbox pass, admin reconcile UI
   before live keys.
5. Reply to Payments.lk with the three policy URLs once the gateway review starts.
