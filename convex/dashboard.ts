import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { currentUser } from "./lib/access";
import { addDays } from "./lib/dates";
import { dayView } from "./lib/dayView";
import { lineAmount } from "./lib/money";
import { lateInfo, openOrders } from "./lib/orders";

const PERIOD = 30;

function profitOf(order: Doc<"orders">) {
  const margin = order.items.reduce((sum, item) => sum + lineAmount(item) - item.cost * item.quantity, 0);
  return margin - (order.discount?.amount ?? 0);
}

function casesOf(order: Doc<"orders">) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

async function ordersBetween(ctx: QueryCtx, from: string, to: string) {
  const orders = await ctx.db
    .query("orders")
    .withIndex("by_date", (q) => q.gte("date", from).lte("date", to))
    .collect();
  return orders.filter((order) => !order.voided);
}

async function paymentsBetween(ctx: QueryCtx, from: string, to: string) {
  const payments = await ctx.db
    .query("payments")
    .withIndex("by_date", (q) => q.gte("date", from).lte("date", to))
    .collect();
  return payments.filter((payment) => !payment.voided);
}

function clientCache(ctx: QueryCtx) {
  const cache = new Map<Id<"clients">, Doc<"clients"> | null>();
  return async (id: Id<"clients">) => {
    if (!cache.has(id)) cache.set(id, await ctx.db.get("clients", id));
    return cache.get(id) ?? null;
  };
}

// Everyone with a balance, grouped by client, most overdue first.
async function debtors(ctx: QueryCtx, today: string) {
  const clientOf = clientCache(ctx);
  const byClient = new Map<Id<"clients">, { balance: number; lateBalance: number; daysLate: number; orders: number }>();
  const aging = { notDue: 0, late1to7: 0, late8to15: 0, late16to30: 0, late31plus: 0 };
  for (const order of await openOrders(ctx)) {
    const balance = order.total - order.amountPaid;
    const { isLate, daysLate } = lateInfo(order, today);
    if (!isLate) aging.notDue += balance;
    else if (daysLate <= 7) aging.late1to7 += balance;
    else if (daysLate <= 15) aging.late8to15 += balance;
    else if (daysLate <= 30) aging.late16to30 += balance;
    else aging.late31plus += balance;
    const entry = byClient.get(order.clientId) ?? { balance: 0, lateBalance: 0, daysLate: 0, orders: 0 };
    entry.balance += balance;
    entry.orders += 1;
    if (isLate) {
      entry.lateBalance += balance;
      entry.daysLate = Math.max(entry.daysLate, daysLate);
    }
    byClient.set(order.clientId, entry);
  }
  const list = [];
  for (const [clientId, entry] of byClient) {
    const client = await clientOf(clientId);
    list.push({ clientId, name: client?.name ?? "—", storeName: client?.storeName, ...entry });
  }
  list.sort((a, b) => b.daysLate - a.daysLate || b.balance - a.balance);
  return { list, aging, total: list.reduce((sum, d) => sum + d.balance, 0) };
}

// Home screen: today at a glance.
export const home = query({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    if (!(await currentUser(ctx))) return null;
    const yesterday = addDays(today, -1);
    const orders = await ordersBetween(ctx, yesterday, today);
    const payments = await paymentsBetween(ctx, yesterday, today);
    const todays = orders.filter((o) => o.date === today);
    const collectedByMethod: Partial<Record<Doc<"payments">["method"], number>> = {};
    for (const payment of payments.filter((p) => p.date === today)) {
      collectedByMethod[payment.method] = (collectedByMethod[payment.method] ?? 0) + payment.amount;
    }

    const { list, total } = await debtors(ctx, today);
    const late = list.filter((d) => d.daysLate > 0);
    const inventory = await dayView(ctx, today);
    const rows = inventory.rows.filter((row) => row.active);
    const products = await ctx.db.query("products").collect();
    const clients = await ctx.db.query("clients").collect();

    return {
      today: {
        orders: todays.length,
        cases: todays.reduce((sum, o) => sum + casesOf(o), 0),
        sales: todays.reduce((sum, o) => sum + o.total, 0),
        collected: Object.values(collectedByMethod).reduce((sum, n) => sum + (n ?? 0), 0),
        collectedByMethod,
        toDeliver: todays.filter((o) => o.fulfillment === "delivery" && o.fulfillmentStatus !== "completed").length,
      },
      yesterday: {
        sales: orders.filter((o) => o.date === yesterday).reduce((sum, o) => sum + o.total, 0),
        collected: payments.filter((p) => p.date === yesterday).reduce((sum, p) => sum + p.amount, 0),
      },
      utang: { total, clients: list.length, late: late.reduce((sum, d) => sum + d.lateBalance, 0) },
      latePayers: late.slice(0, 6),
      lateCount: late.length,
      stock: {
        status: inventory.status,
        previousOpen: inventory.previousOpen,
        starting: rows.reduce((sum, r) => sum + r.starting, 0),
        now: rows.reduce((sum, r) => sum + r.expected, 0),
        rows,
        low: rows.filter((r) => r.lowStockLevel > 0 && r.expected <= r.lowStockLevel),
      },
      setup: {
        products: products.filter((p) => p.active).length,
        clients: clients.filter((c) => c.active).length,
      },
    };
  },
});

// Reports: the last 30 days against the 30 before.
export const reports = query({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    if (!(await currentUser(ctx))) return null;
    const start = addDays(today, -(PERIOD - 1));
    const prevStart = addDays(start, -PERIOD);
    const prevEnd = addDays(start, -1);
    const orders = await ordersBetween(ctx, prevStart, today);
    const payments = await paymentsBetween(ctx, prevStart, today);
    const current = orders.filter((o) => o.date >= start);
    const previous = orders.filter((o) => o.date <= prevEnd);
    const currentPayments = payments.filter((p) => p.date >= start);
    const previousPayments = payments.filter((p) => p.date <= prevEnd);

    const totals = (list: Doc<"orders">[], paid: Doc<"payments">[]) => ({
      sales: list.reduce((sum, o) => sum + o.total, 0),
      collected: paid.reduce((sum, p) => sum + p.amount, 0),
      profit: list.reduce((sum, o) => sum + profitOf(o), 0),
      cases: list.reduce((sum, o) => sum + casesOf(o), 0),
      orders: list.length,
    });

    const trend = [];
    for (let i = 0; i < PERIOD; i++) {
      const date = addDays(start, i);
      trend.push({
        date,
        sales: current.filter((o) => o.date === date).reduce((sum, o) => sum + o.total, 0),
        collected: currentPayments.filter((p) => p.date === date).reduce((sum, p) => sum + p.amount, 0),
      });
    }

    // Average sales for each weekday over the last four full weeks.
    const weekdayTotals = Array.from({ length: 7 }, () => 0);
    const fourWeeks = addDays(today, -27);
    for (const order of current.filter((o) => o.date >= fourWeeks)) {
      weekdayTotals[new Date(`${order.date}T00:00:00Z`).getUTCDay()] += order.total;
    }
    const weekdays = weekdayTotals.map((sum, day) => ({ day, average: Math.round(sum / 4) }));

    const inventory = await dayView(ctx, today);
    const stockNow = new Map(inventory.rows.map((row) => [row.productId, row.expected]));
    const productTotals = new Map<Id<"products">, { productId: Id<"products">; name: string; cases: number; sales: number }>();
    const clientTotals = new Map<Id<"clients">, { sales: number; orders: number }>();
    for (const order of current) {
      for (const item of order.items) {
        const entry = productTotals.get(item.productId) ?? { productId: item.productId, name: item.name, cases: 0, sales: 0 };
        entry.cases += item.quantity;
        entry.sales += lineAmount(item);
        productTotals.set(item.productId, entry);
      }
      const entry = clientTotals.get(order.clientId) ?? { sales: 0, orders: 0 };
      entry.sales += order.total;
      entry.orders += 1;
      clientTotals.set(order.clientId, entry);
    }
    const products = await ctx.db.query("products").collect();
    const categoryOf = new Map(products.map((p) => [p._id, p.category]));
    const bestSellers = [...productTotals.values()]
      .sort((a, b) => b.cases - a.cases)
      .slice(0, 6)
      .map((p) => ({ ...p, category: categoryOf.get(p.productId) ?? "other", inStock: stockNow.get(p.productId) ?? 0 }));
    const clientOf = clientCache(ctx);
    const topClients = [];
    for (const [clientId, entry] of [...clientTotals].sort((a, b) => b[1].sales - a[1].sales).slice(0, 6)) {
      const client = await clientOf(clientId);
      topClients.push({ clientId, name: client?.name ?? "—", storeName: client?.storeName, ...entry });
    }

    const { aging, total } = await debtors(ctx, today);
    const owing = await ctx.db
      .query("clientEmpties")
      .withIndex("by_owed", (q) => q.gt("owed", 0))
      .collect();

    return {
      current: totals(current, currentPayments),
      previous: totals(previous, previousPayments),
      trend,
      weekdays,
      aging,
      utang: total,
      bestSellers,
      topClients,
      empties: {
        owedByClients: owing.reduce((sum, row) => sum + row.owed, 0),
        onHand: products.filter((p) => p.active && p.returnable).reduce((sum, p) => sum + p.emptiesOnHand, 0),
      },
    };
  },
});

// Small counts for the navigation badges and the alerts bell.
export const alerts = query({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    if (!(await currentUser(ctx))) return null;
    const { list } = await debtors(ctx, today);
    const late = list.filter((d) => d.daysLate > 0);
    const inventory = await dayView(ctx, today);
    const low = inventory.rows.filter((r) => r.active && r.lowStockLevel > 0 && r.expected <= r.lowStockLevel);
    const todays = await ctx.db
      .query("orders")
      .withIndex("by_date", (q) => q.eq("date", today))
      .collect();
    return {
      late: late.slice(0, 5).map((d) => ({ clientId: d.clientId, name: d.name, lateBalance: d.lateBalance, daysLate: d.daysLate })),
      lateCount: late.length,
      low: low.map((r) => ({ productId: r.productId, name: r.name, left: r.expected })),
      previousOpen: inventory.previousOpen,
      todayStatus: inventory.status,
      toDeliver: todays.filter(
        (o) => !o.voided && o.fulfillment === "delivery" && o.fulfillmentStatus !== "completed",
      ).length,
    };
  },
});
