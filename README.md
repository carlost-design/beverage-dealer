# Dealer Inventory

Inventory, orders and collections for a softdrinks and beer dealer. React + Vite on the front, Convex for the database.

## What it does

- **Daily inventory.** Each day's starting stock is the previous day's closing count. During the day, stock-ins, sales, voids, damage (basag) and adjustments are recorded as movements. At closing you count the warehouse, and any variance (kulang / sobra) is saved. A day that isn't closed is closed automatically the next day, using the system's numbers, and marked "not counted".
- **Orders.** Sold by the case. Stock is checked live and deducted when the order is saved. Each client's usual discount (₱ per case, % or fixed ₱) fills in automatically and can be changed per order. Orders are delivery or pickup, and you can take a full or partial payment on the spot.
- **Empties.** For returnable products, the app tracks the empty cases each client still owes, empties returned with orders or separately, and the empties in the warehouse. When a supplier delivers, it records the empties given back to them.
- **Collections.** Each client has payment terms (pay on delivery, 7/15/30 days, or custom). An order past its due date is late: it turns red and shows *Hindi pa bayad* / *May balanse* with the days late, and the client's name turns red everywhere. A lump-sum payment from a client goes to their oldest due orders first.
- **Dashboard.** Shows sales vs collections today and for the last 30 days, total utang, late payers, balances grouped by days late, stock and low-stock alerts, empties, and top products and clients.
- **Printing** on 58 mm or 80 mm thermal paper: order slips / delivery receipts (1 or 2 copies), a statement of account per client, and the day's inventory report.
- **Activity log** of voids, discount changes, price changes, stock adjustments, payments removed and day closings. There's one owner login.
- **Made for elderly owners.** Text is 18 px by default, with a Large and an Extra large setting (per device, from the **Aa** button or Settings). Buttons are big, contrast is high, and every control has a word on it. The main jobs are step-by-step: New order (client → cases → delivery and payment → check and save), Receive payment, Delivery arrived and Close the day. Each ends with a clear "saved" screen.
- **English or Filipino.** Switch at the top of any screen. The choice is saved on the account, so every device follows it, and receipts print in the same language. The status words (Bayad na, May balanse, Hindi pa bayad) stay in Tagalog in both.

## Run it on this computer

```bash
npm install
npm run dev
```

This starts the Convex backend and the web app at http://localhost:5173. The first time you open it, create the owner account. Only one account can be made.

This copy uses a **local** Convex backend (no account needed). Its data is stored in the `.convex` folder inside this project.

### Sample data

The local database has 12 days of made-up sample data (products, clients, orders, payments) to click around in. Clear it before using the app for real:

```bash
npx convex run seed:reset
```

`npx convex run seed:sampleData` loads it again, but only into an empty database.

## Go live (laptop, iPad and phone)

The iPad and phone need the app on the internet, not on this laptop.

1. `npx convex login` to create a free Convex account and link this project.
2. `npx convex deploy` to create the production database and upload the functions.
3. `npx @convex-dev/auth --prod` to set up the login keys on production.
4. Host the web app on Vercel (or Netlify):
   - Build command: `npx convex deploy --cmd 'npm run build'`
   - Environment variable `CONVEX_DEPLOY_KEY`: generate a production deploy key in the Convex dashboard (Deployment Settings).
5. On the iPad and phone, open the site and use Share → Add to Home Screen so it opens like an app.

Production starts empty. Create the owner account there and add the real products and clients.

## Printing

- In Settings, set the business name, the paper width (58 or 80 mm), the number of copies, and the footer. Use **Test print** to check the alignment.
- In the print dialog, pick the thermal printer, set its roll paper size, and set margins to none.
- From an iPad or phone, the printer must support AirPrint. Most cheap Bluetooth 58 mm printers don't, so print from the laptop or use an AirPrint-capable model.
- Slips say "This is not an official receipt" by default. If they need to count as BIR invoices, check the rules for computer-generated invoices with your accountant first.

## Design

The look follows the owner's reference video: a light admin dashboard scaled up for older eyes. `DESIGN.md` records the colors, type, components and rules. `PRODUCT.md` records who the app is for and what it must do.

## Project layout

```
convex/            Database schema and server functions
  schema.ts        Tables
  lib/stock.ts     Day opening, carry-over, stock and empties movements
  lib/orders.ts    Order creation/editing, totals, discounts, payments, late status
  orders.ts, payments.ts, inventory.ts, clients.ts, products.ts, dashboard.ts, settings.ts
  seed.ts          Sample data, reset, and login cleanup
src/
  pages/           One file per screen (NewOrder, ReceivePayment and DeliveryArrived are the step-by-step flows)
  components/      UI pieces, charts, receipts, printing
  i18n/            Every word on screen in English and Filipino
```

Money is stored in centavos and quantities in whole cases. Business dates are `YYYY-MM-DD` in Philippine time.
