// Sample data for trying the app locally. It replays 12 days of activity
// (stock in, orders, payments, damage, day closing) through the same helpers
// the real screens use, so it also exercises the inventory and payment logic.
//
//   npx convex run seed:sampleData   (only runs on an empty database)
//   npx convex run seed:reset        (deletes all business data; keeps logins)
//
// Product prices and the clients below are made up. Replace them with real ones.
//
//   npx convex run seed:removeLogins (deletes all logins, so the next visit asks
//                                     you to create the owner account again)
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { addDays, manilaDate } from "./lib/dates";
import { addPayment, createOrder, type ItemInput } from "./lib/orders";
import { availableStock, expectedClosing, moveStock, openDay, recordEmpties } from "./lib/stock";
import { fail } from "./lib/access";

const PRODUCTS = [
  { name: "Coke 8oz", category: "softdrinks", price: 32000, cost: 29000, returnable: true, low: 20, stock: 140, empties: 40 },
  { name: "Royal 8oz", category: "softdrinks", price: 32000, cost: 29000, returnable: true, low: 15, stock: 90, empties: 25 },
  { name: "Sprite 8oz", category: "softdrinks", price: 32000, cost: 29000, returnable: true, low: 15, stock: 70, empties: 20 },
  { name: "Coke 1L", category: "softdrinks", price: 54000, cost: 50000, returnable: true, low: 10, stock: 55, empties: 15 },
  { name: "Coke 1.5L PET", category: "softdrinks", price: 84000, cost: 78000, returnable: false, low: 10, stock: 40, empties: 0 },
  { name: "Pale Pilsen 320ml", category: "beer", price: 115000, cost: 108000, returnable: true, low: 15, stock: 95, empties: 30 },
  { name: "Red Horse 500ml", category: "beer", price: 120000, cost: 113000, returnable: true, low: 15, stock: 110, empties: 35 },
  { name: "Red Horse 1L", category: "beer", price: 102000, cost: 96000, returnable: true, low: 10, stock: 60, empties: 20 },
  { name: "San Mig Light 330ml", category: "beer", price: 125000, cost: 117000, returnable: true, low: 10, stock: 30, empties: 15 },
] as const;

const CLIENTS: {
  key: string;
  name: string;
  storeName?: string;
  phone?: string;
  address?: string;
  termsDays: number;
  creditLimit?: number;
  discounts?: Record<string, number>; // product name → centavos off each case
}[] = [
  { key: "nena", name: "Aling Nena", storeName: "Nena's Sari-sari Store", phone: "0917 000 0001", address: "Purok 3, Brgy. San Isidro", termsDays: 7, discounts: { "Coke 8oz": 500, "Coke 1.5L PET": 1000 } },
  { key: "jun", name: "Mang Jun", storeName: "Jun's Carinderia", phone: "0917 000 0002", address: "Rizal St., Poblacion", termsDays: 15, discounts: { "Red Horse 1L": 2000 } },
  { key: "ben", name: "Kuya Ben", storeName: "Ben's Videoke Bar", phone: "0917 000 0003", address: "National Highway, Brgy. Maligaya", termsDays: 0 },
  { key: "liza", name: "Ate Liza", storeName: "Liza Mini Mart", phone: "0917 000 0004", address: "Mabini St., Poblacion", termsDays: 30, creditLimit: 5_000_000 },
  { key: "rudy", name: "Tito Rudy", storeName: "Rudy's Store", phone: "0917 000 0005", address: "Purok 1, Brgy. Bagong Silang", termsDays: 7 },
  { key: "walkin", name: "Walk-in", termsDays: 0 },
];

type Line = [product: string, cases: number, empties?: number];
type PlannedOrder = {
  day: number; // days before today
  client: string;
  lines: Line[];
  pickup?: boolean;
  payNow?: boolean;
  payments?: { day: number; amount: number | "rest"; method?: Doc<"payments">["method"] }[];
  pending?: boolean;
};

// Scenarios: Tito Rudy and Kuya Ben end up late, Aling Nena is late on a
// partial balance, Mang Jun and Ate Liza are on longer terms and not yet due.
const ORDERS: PlannedOrder[] = [
  { day: 11, client: "rudy", lines: [["Coke 8oz", 10], ["Royal 8oz", 5]] },
  { day: 11, client: "jun", lines: [["Red Horse 500ml", 6], ["Pale Pilsen 320ml", 4]], payments: [{ day: 5, amount: "rest", method: "gcash" }] },
  { day: 11, client: "walkin", lines: [["Coke 1.5L PET", 2]], pickup: true, payNow: true },
  { day: 10, client: "nena", lines: [["Coke 8oz", 8], ["Sprite 8oz", 4, 3]], payments: [{ day: 6, amount: "rest" }] },
  { day: 10, client: "ben", lines: [["Red Horse 1L", 5], ["San Mig Light 330ml", 3]], pickup: true, payNow: true },
  { day: 9, client: "nena", lines: [["Coke 8oz", 6], ["Coke 1L", 4]], payments: [{ day: 4, amount: 200000 }] },
  { day: 9, client: "liza", lines: [["Coke 1.5L PET", 6], ["Coke 8oz", 10], ["Royal 8oz", 6]] },
  { day: 8, client: "jun", lines: [["Red Horse 500ml", 8], ["Red Horse 1L", 4]] },
  { day: 8, client: "walkin", lines: [["Red Horse 1L", 1]], pickup: true, payNow: true },
  { day: 7, client: "ben", lines: [["Red Horse 500ml", 5], ["Pale Pilsen 320ml", 5]], pickup: true, payNow: true },
  { day: 7, client: "rudy", lines: [["Sprite 8oz", 5], ["Coke 1L", 3]], payments: [{ day: 1, amount: "rest", method: "cash" }] },
  { day: 6, client: "liza", lines: [["San Mig Light 330ml", 4], ["Pale Pilsen 320ml", 6]] },
  { day: 6, client: "nena", lines: [["Royal 8oz", 6], ["Coke 8oz", 6]], payments: [{ day: 2, amount: "rest", method: "gcash" }] },
  { day: 5, client: "jun", lines: [["Coke 8oz", 12], ["Coke 1L", 6]] },
  { day: 5, client: "walkin", lines: [["Coke 8oz", 2, 2]], pickup: true, payNow: true },
  { day: 4, client: "ben", lines: [["Red Horse 1L", 6], ["Red Horse 500ml", 4]], pickup: true, payments: [{ day: 2, amount: 300000, method: "cash" }] },
  { day: 3, client: "ben", lines: [["Pale Pilsen 320ml", 6], ["San Mig Light 330ml", 2]], pickup: true },
  { day: 3, client: "liza", lines: [["Coke 1L", 8], ["Sprite 8oz", 6]] },
  { day: 2, client: "nena", lines: [["Coke 8oz", 10], ["Royal 8oz", 4]] },
  { day: 2, client: "rudy", lines: [["Red Horse 500ml", 3]] },
  { day: 1, client: "jun", lines: [["Red Horse 500ml", 10], ["Coke 1.5L PET", 4]] },
  { day: 1, client: "walkin", lines: [["Royal 8oz", 3, 3]], pickup: true, payNow: true },
  { day: 0, client: "nena", lines: [["Coke 8oz", 8], ["Sprite 8oz", 4]], pending: true },
  { day: 0, client: "liza", lines: [["Red Horse 500ml", 6], ["San Mig Light 330ml", 5], ["Coke 1.5L PET", 3]], pending: true },
  { day: 0, client: "ben", lines: [["Red Horse 1L", 4]], pickup: true, payNow: true },
];

// Supplier deliveries, keyed by days before today.
const DELIVERIES: Record<number, { supplier: string; lines: [string, number][] }> = {
  9: { supplier: "Coca-Cola Beverages", lines: [["Coke 8oz", 40], ["Royal 8oz", 20], ["Coke 1L", 20]] },
  6: { supplier: "San Miguel Brewery", lines: [["Red Horse 500ml", 40], ["Pale Pilsen 320ml", 30]] },
  3: { supplier: "Coca-Cola Beverages", lines: [["Coke 8oz", 30], ["Sprite 8oz", 20], ["Coke 1.5L PET", 20]] },
  0: { supplier: "San Miguel Brewery", lines: [["Red Horse 1L", 20], ["San Mig Light 330ml", 10]] },
};

const DAYS = 12;

export const sampleData = internalMutation({
  args: {},
  handler: async (ctx) => {
    if ((await ctx.db.query("products").first()) || (await ctx.db.query("orders").first())) {
      fail("The database already has data. Run seed:reset first.", "The database already has data. Run seed:reset first.");
    }
    const today = manilaDate();
    const dateOf = (daysAgo: number) => addDays(today, -daysAgo);

    await ctx.db.insert("settings", {
      businessName: "Sample Softdrinks & Beer Dealer",
      address: "Poblacion, Sample Town",
      phone: "0917 000 0000",
      receiptFooter: "Salamat po!\nThis is not an official receipt.",
      paperWidth: "58mm",
      receiptCopies: 1,
      depositPerCase: 15000,
    });

    const firstDay = dateOf(DAYS - 1);
    await openDay(ctx, firstDay);
    const products = new Map<string, Id<"products">>();
    for (const p of PRODUCTS) {
      const productId = await ctx.db.insert("products", {
        name: p.name,
        category: p.category,
        price: p.price,
        cost: p.cost,
        returnable: p.returnable,
        lowStockLevel: p.low,
        emptiesOnHand: 0,
        active: true,
      });
      products.set(p.name, productId);
      await moveStock(ctx, { date: firstDay, productId, field: "adjusted", quantity: p.stock, type: "adjustment", note: "Opening stock" });
      if (p.empties > 0) {
        await recordEmpties(ctx, { date: firstDay, productId, type: "warehouse_adjustment", quantity: p.empties, note: "Opening empties" });
      }
    }

    const clients = new Map<string, Id<"clients">>();
    for (const { key, discounts, ...client } of CLIENTS) {
      const productDiscounts = discounts
        ? Object.entries(discounts).map(([name, perCase]) => ({ productId: products.get(name)!, perCase }))
        : undefined;
      clients.set(key, await ctx.db.insert("clients", { ...client, productDiscounts, active: true }));
    }

    const created: { plan: PlannedOrder; orderId: Id<"orders"> }[] = [];
    for (let daysAgo = DAYS - 1; daysAgo >= 0; daysAgo--) {
      const date = dateOf(daysAgo);
      await openDay(ctx, date);

      const delivery = DELIVERIES[daysAgo];
      if (delivery) await receiveDelivery(ctx, date, delivery, products);

      // Payments on earlier orders that come in today.
      for (const { plan, orderId } of created) {
        for (const payment of plan.payments ?? []) {
          if (payment.day !== daysAgo) continue;
          const order = (await ctx.db.get("orders", orderId))!;
          const balance = order.total - order.amountPaid;
          const amount = payment.amount === "rest" ? balance : Math.min(payment.amount, balance);
          if (amount > 0) await addPayment(ctx, order, { amount, method: payment.method ?? "cash", date });
        }
      }

      for (const plan of ORDERS.filter((o) => o.day === daysAgo)) {
        const clientId = clients.get(plan.client)!;
        const client = (await ctx.db.get("clients", clientId))!;
        const usual = new Map((client.productDiscounts ?? []).map((d) => [d.productId, d.perCase]));
        const items: ItemInput[] = [];
        for (const [name, cases, empties] of plan.lines) {
          const productId = products.get(name)!;
          const quantity = Math.min(cases, await availableStock(ctx, date, productId));
          if (quantity > 0) {
            items.push({ productId, quantity, emptiesReturned: empties ?? quantity, discountPerCase: usual.get(productId) });
          }
        }
        if (items.length === 0) continue;
        const { order } = await createOrder(ctx, date, {
          clientId,
          fulfillment: plan.pickup ? "pickup" : "delivery",
          completed: !plan.pending,
          items,
        });
        if (plan.payNow) {
          await addPayment(ctx, order, { amount: order.total, method: "cash", date });
        }
        created.push({ plan, orderId: order._id });
      }

      if (daysAgo === 5) {
        await moveStock(ctx, { date, productId: products.get("Coke 8oz")!, field: "damaged", quantity: 1, type: "damage", note: "Basag during unloading" });
      }

      if (daysAgo > 0 && daysAgo !== 4) await closeWithCount(ctx, date, daysAgo === 7 ? products.get("Royal 8oz")! : undefined);
      // Day 4 is left open on purpose: the next day closes it automatically as "not counted".
    }

    // One delivery is on the road right now.
    const outForDelivery = created.find((c) => c.plan.day === 0 && c.plan.client === "liza");
    if (outForDelivery) {
      await ctx.db.patch("orders", outForDelivery.orderId, { fulfillmentStatus: "out_for_delivery" });
    }
    return `Created ${PRODUCTS.length} products, ${CLIENTS.length} clients and ${created.length} orders.`;
  },
});

async function receiveDelivery(
  ctx: MutationCtx,
  date: string,
  delivery: { supplier: string; lines: [string, number][] },
  products: Map<string, Id<"products">>,
) {
  const items = [];
  const emptiesReturned = [];
  for (const [name, quantity] of delivery.lines) {
    const product = (await ctx.db.get("products", products.get(name)!))!;
    items.push({ productId: product._id, name: product.name, quantity, cost: product.cost });
    const empties = product.returnable ? Math.min(quantity, product.emptiesOnHand) : 0;
    if (empties > 0) emptiesReturned.push({ productId: product._id, name: product.name, quantity: empties });
  }
  const stockInId = await ctx.db.insert("stockIns", {
    date,
    supplier: delivery.supplier,
    items,
    emptiesReturned,
    totalCost: items.reduce((sum, item) => sum + item.cost * item.quantity, 0),
  });
  for (const item of items) {
    await moveStock(ctx, { date, productId: item.productId, field: "stockIn", quantity: item.quantity, type: "stock_in", stockInId, note: `From ${delivery.supplier}` });
  }
  for (const item of emptiesReturned) {
    await recordEmpties(ctx, { date, productId: item.productId, type: "to_supplier", quantity: item.quantity, stockInId, note: `To ${delivery.supplier}` });
  }
}

// Closes a day with a physical count that matches, except one case missing
// from `shortProduct` (to show a variance).
async function closeWithCount(ctx: MutationCtx, date: string, shortProduct?: Id<"products">) {
  const rows = await ctx.db
    .query("dailyStock")
    .withIndex("by_date_product", (q) => q.eq("date", date))
    .collect();
  for (const row of rows) {
    const expected = expectedClosing(row);
    await ctx.db.patch("dailyStock", row._id, {
      counted: row.productId === shortProduct ? expected - 1 : expected,
    });
  }
  const day = await ctx.db
    .query("inventoryDays")
    .withIndex("by_date", (q) => q.eq("date", date))
    .unique();
  await ctx.db.patch("inventoryDays", day!._id, { status: "closed", counted: true, closedAt: Date.now() });
}

const BUSINESS_TABLES = [
  "settings",
  "products",
  "clients",
  "inventoryDays",
  "dailyStock",
  "stockMovements",
  "stockIns",
  "orders",
  "payments",
  "clientEmpties",
  "emptiesMovements",
  "counters",
  "auditLog",
] as const;

export const reset = internalMutation({
  args: {},
  handler: async (ctx) => {
    let deleted = 0;
    for (const table of BUSINESS_TABLES) {
      for (const doc of await ctx.db.query(table).collect()) {
        await ctx.db.delete(table, doc._id);
        deleted++;
      }
    }
    return `Deleted ${deleted} records.`;
  },
});

const AUTH_TABLES = [
  "users",
  "authAccounts",
  "authSessions",
  "authRefreshTokens",
  "authVerificationCodes",
  "authVerifiers",
  "authRateLimits",
] as const;

// Deletes every login so the next visit shows "Set up your store" again.
export const removeLogins = internalMutation({
  args: {},
  handler: async (ctx) => {
    let deleted = 0;
    for (const table of AUTH_TABLES) {
      for (const doc of await ctx.db.query(table).collect()) {
        await ctx.db.delete(table, doc._id);
        deleted++;
      }
    }
    return `Deleted ${deleted} login records.`;
  },
});
