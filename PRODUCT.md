# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Owners of softdrinks and beer dealerships in the Philippines, many of them elderly. For now only the owner uses the app. They use a laptop, an iPad, and sometimes a phone, in the store or warehouse during the day. They take orders from sari-sari stores and other regular clients (suki), collect utang, receive supplier deliveries, and count the stock at closing.

## Product Purpose

Replaces the notebook for a beverage dealer's day: starting and closing stock that carries over day to day, orders by the case, collections with clear late-payment flags, empties (returnable bottles and cases), and printed receipts. Success means an elderly owner can run the whole day without help and always knows who owes what.

## Positioning

Built around how PH beverage dealers actually work: sold per case only, returnable empties tracked per client, per-client payment terms and negotiated discounts, and Tagalog status words the owner already uses (Bayad na, May balanse, Hindi pa bayad).

## Operating Context

- Each day's starting stock is the previous day's closing count. Stock-ins from suppliers, sales, damage (basag) and corrections are recorded during the day. At closing the owner counts the storage and differences (kulang / sobra) are saved.
- Orders are delivery or pickup, and can be paid now, in part, or on utang. They are late after the due date (order date + the client's terms).
- Receipts print on 58 mm or 80 mm thermal printers, usually from the laptop. iPads and phones need an AirPrint printer.

## Capabilities and Constraints

- Sold per case only, never per piece. Money is stored in centavos. Business dates are Philippine time.
- There is one owner account. Staff roles are not built yet.
- An English / Filipino switch is saved on the account. The payment status words stay in Tagalog in both languages.
- Stack: React + Vite + Tailwind, with Convex as the database and Convex Auth for login.
- Not decided yet: going live (Convex prod + Vercel), forgot-password, SMS reminders, delivery routes.

## Brand Commitments

- Visual reference supplied by the user: a modern light admin dashboard ("Shopeers" video, 2026-09-27). The look is: white rounded cards on a soft gray canvas, a white sidebar with a pill-shaped active item, a search pill in the top bar, big bold numbers with small green/red change chips, blue gradient line charts, pill buttons.
- No logo or brand name yet. The sidebar shows the store name from Settings.

## Evidence on Hand

- The only data is sample data (made-up products, clients and orders) from `convex/seed.ts`. It is labeled as sample and replaced before real use.
- There are no real customer testimonials, logos or product photos.

## Product Principles

1. One clear next action per screen. Step-by-step flows beat dense forms.
2. Money and lateness are never ambiguous. Late means red, labeled, and with the number of days.
3. Numbers must add up. Stock, empties and payments always reconcile.
4. Speak the owner's language: plain words, Filipino or English, and the business's own Tagalog terms.

## Accessibility & Inclusion

The primary users are elderly. They need:
- large text (18 px or more by default) and a text size setting per device
- touch targets of 48 px or more
- strong contrast (WCAG AA or better)
- labels in words, not icon-only controls
- no hover-only information
- clear success confirmations
