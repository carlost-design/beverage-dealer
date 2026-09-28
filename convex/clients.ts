import { v, type Infer } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { cleanText, currentUser, fail, logActivity, requireUser, requireWholeNumber } from "./lib/access";
import { manilaDate } from "./lib/dates";
import { describeDiscount } from "./lib/money";
import { lateInfo, openOrders, openOrdersForClient } from "./lib/orders";
import { recordEmpties } from "./lib/stock";
import { discountRule } from "./schema";

const clientFields = v.object({
  name: v.string(),
  storeName: v.optional(v.string()),
  phone: v.optional(v.string()),
  address: v.optional(v.string()),
  termsDays: v.number(),
  creditLimit: v.optional(v.number()),
  discount: v.optional(discountRule),
  notes: v.optional(v.string()),
});

function cleanClient(input: Infer<typeof clientFields>) {
  const name = cleanText(input.name);
  if (!name) fail("Enter the client's name.", "Ilagay ang pangalan ng suki.");
  requireWholeNumber(input.termsDays, ["Payment terms", "terms ng bayad"]);
  if (input.termsDays > 365) fail("Payment terms can be at most 365 days.", "Hanggang 365 araw lang ang terms ng bayad.");
  if (input.creditLimit !== undefined) requireWholeNumber(input.creditLimit, ["Credit limit", "credit limit"]);
  let discount = input.discount;
  if (discount && discount.value === 0) discount = undefined;
  if (discount?.type === "percent" && !(discount.value > 0 && discount.value <= 100)) {
    fail("A percent discount must be between 0 and 100.", "Ang % na discount ay dapat mula 0 hanggang 100.");
  }
  if (discount && discount.type !== "percent") requireWholeNumber(discount.value, ["Discount", "discount"]);
  return {
    name,
    storeName: cleanText(input.storeName),
    phone: cleanText(input.phone),
    address: cleanText(input.address),
    termsDays: input.termsDays,
    creditLimit: input.creditLimit ? input.creditLimit : undefined,
    discount,
    notes: cleanText(input.notes),
  };
}

type Balance = { balance: number; lateBalance: number; daysLate: number; openCount: number };
const NO_BALANCE: Balance = { balance: 0, lateBalance: 0, daysLate: 0, openCount: 0 };

export const list = query({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    if (!(await currentUser(ctx))) return null;
    const balances = new Map<Id<"clients">, Balance>();
    for (const order of await openOrders(ctx)) {
      const entry = { ...(balances.get(order.clientId) ?? NO_BALANCE) };
      const due = order.total - order.amountPaid;
      const late = lateInfo(order, today);
      entry.balance += due;
      entry.openCount += 1;
      if (late.isLate) {
        entry.lateBalance += due;
        entry.daysLate = Math.max(entry.daysLate, late.daysLate);
      }
      balances.set(order.clientId, entry);
    }
    const empties = new Map<Id<"clients">, number>();
    const owing = await ctx.db
      .query("clientEmpties")
      .withIndex("by_owed", (q) => q.gt("owed", 0))
      .collect();
    for (const row of owing) empties.set(row.clientId, (empties.get(row.clientId) ?? 0) + row.owed);

    const clients = await ctx.db.query("clients").collect();
    return clients
      .map((client) => ({
        ...client,
        ...(balances.get(client._id) ?? NO_BALANCE),
        emptiesOwed: empties.get(client._id) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const get = query({
  args: { clientId: v.string(), today: v.string() },
  handler: async (ctx, { clientId, today }) => {
    if (!(await currentUser(ctx))) return null;
    const id = ctx.db.normalizeId("clients", clientId);
    const client = id ? await ctx.db.get("clients", id) : null;
    if (!client) return null;

    const open = (await openOrdersForClient(ctx, client._id)).map((order) => ({
      _id: order._id,
      orderNo: order.orderNo,
      date: order.date,
      dueDate: order.dueDate,
      total: order.total,
      amountPaid: order.amountPaid,
      balance: order.total - order.amountPaid,
      paymentStatus: order.paymentStatus,
      ...lateInfo(order, today),
    }));
    const balance = open.reduce((sum, order) => sum + order.balance, 0);
    const late = open.filter((order) => order.isLate);

    const recent = await ctx.db
      .query("orders")
      .withIndex("by_client_date", (q) => q.eq("clientId", client._id))
      .order("desc")
      .take(20);
    const recentOrders = recent.map((order) => ({
      _id: order._id,
      orderNo: order.orderNo,
      date: order.date,
      total: order.total,
      paymentStatus: order.paymentStatus,
      voided: order.voided,
      cases: order.items.reduce((sum, item) => sum + item.quantity, 0),
      ...lateInfo(order, today),
    }));

    const paymentDocs = await ctx.db
      .query("payments")
      .withIndex("by_client", (q) => q.eq("clientId", client._id))
      .order("desc")
      .take(20);
    const payments = [];
    for (const payment of paymentDocs) {
      const order = await ctx.db.get("orders", payment.orderId);
      payments.push({ ...payment, orderNo: order?.orderNo ?? 0 });
    }

    const emptiesRows = await ctx.db
      .query("clientEmpties")
      .withIndex("by_client_product", (q) => q.eq("clientId", client._id))
      .collect();
    const empties = [];
    for (const row of emptiesRows.filter((r) => r.owed !== 0)) {
      const product = await ctx.db.get("products", row.productId);
      empties.push({ productId: row.productId, name: product?.name ?? "Deleted product", owed: row.owed });
    }

    return {
      client,
      openOrders: open,
      balance,
      lateBalance: late.reduce((sum, order) => sum + order.balance, 0),
      daysLate: late.reduce((max, order) => Math.max(max, order.daysLate), 0),
      recentOrders,
      payments,
      empties: empties.sort((a, b) => a.name.localeCompare(b.name)),
      emptiesOwed: empties.reduce((sum, row) => sum + Math.max(row.owed, 0), 0),
    };
  },
});

export const create = mutation({
  args: { client: clientFields },
  handler: async (ctx, { client }) => {
    const userId = await requireUser(ctx);
    const fields = cleanClient(client);
    const clientId = await ctx.db.insert("clients", { ...fields, active: true });
    await logActivity(ctx, userId, "Added client", fields.name);
    return clientId;
  },
});

export const update = mutation({
  args: { clientId: v.id("clients"), client: clientFields },
  handler: async (ctx, { clientId, client }) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db.get("clients", clientId);
    if (!existing) fail("Client not found.", "Hindi makita ang suki.");
    const fields = cleanClient(client);
    await ctx.db.patch("clients", clientId, fields);

    const changes = [];
    const oldDiscount = existing.discount ? describeDiscount(existing.discount) : "none";
    const newDiscount = fields.discount ? describeDiscount(fields.discount) : "none";
    if (oldDiscount !== newDiscount) changes.push(`discount ${oldDiscount} → ${newDiscount}`);
    if (existing.termsDays !== fields.termsDays) {
      changes.push(`terms ${existing.termsDays} → ${fields.termsDays} days`);
    }
    if (existing.creditLimit !== fields.creditLimit) changes.push("credit limit changed");
    await logActivity(
      ctx,
      userId,
      "Updated client",
      `${fields.name}${changes.length ? `: ${changes.join(", ")}` : ""}`,
    );
  },
});

export const setActive = mutation({
  args: { clientId: v.id("clients"), active: v.boolean() },
  handler: async (ctx, { clientId, active }) => {
    const userId = await requireUser(ctx);
    const client = await ctx.db.get("clients", clientId);
    if (!client) fail("Client not found.", "Hindi makita ang suki.");
    await ctx.db.patch("clients", clientId, { active });
    await logActivity(ctx, userId, active ? "Restored client" : "Archived client", client.name);
  },
});

// Empties brought back without an order.
export const returnEmpties = mutation({
  args: {
    clientId: v.id("clients"),
    items: v.array(v.object({ productId: v.id("products"), quantity: v.number() })),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { clientId, items, note }) => {
    const userId = await requireUser(ctx);
    const client = await ctx.db.get("clients", clientId);
    if (!client) fail("Client not found.", "Hindi makita ang suki.");
    const date = manilaDate();
    const summary = [];
    for (const item of items) {
      requireWholeNumber(item.quantity, ["Empties", "empties"]);
      if (item.quantity === 0) continue;
      const product = await ctx.db.get("products", item.productId);
      if (!product?.returnable) fail("Only returnable products have empties.", "Ang mga produktong may ibinabalik na kaha lang ang may empties.");
      await recordEmpties(ctx, {
        date,
        productId: product._id,
        clientId,
        type: "client_return",
        quantity: item.quantity,
        note: cleanText(note),
      });
      summary.push(`${item.quantity} ${product.name}`);
    }
    if (summary.length === 0) fail("Enter how many empty cases came back.", "Ilagay kung ilang bakanteng kaha ang ibinalik.");
    await logActivity(ctx, userId, "Empties returned", `${client.name}: ${summary.join(", ")}`);
  },
});

// Corrections: an opening balance, a deposit paid instead of returning
// empties, or empties written off.
export const adjustEmpties = mutation({
  args: {
    clientId: v.id("clients"),
    productId: v.id("products"),
    delta: v.number(),
    note: v.string(),
  },
  handler: async (ctx, { clientId, productId, delta, note }) => {
    const userId = await requireUser(ctx);
    const client = await ctx.db.get("clients", clientId);
    const product = await ctx.db.get("products", productId);
    if (!client || !product) fail("Client or product not found.", "Hindi makita ang suki o ang produkto.");
    if (!product.returnable) fail("Only returnable products have empties.", "Ang mga produktong may ibinabalik na kaha lang ang may empties.");
    if (!Number.isInteger(delta) || delta === 0) {
      fail("Enter a whole number of cases, like 5 or -5.", "Maglagay ng buong bilang ng kaha, halimbawa 5 o -5.");
    }
    const why = cleanText(note);
    if (!why) fail("Enter a reason for the adjustment.", "Ilagay ang dahilan ng pagtama.");
    await recordEmpties(ctx, {
      date: manilaDate(),
      productId,
      clientId,
      type: "client_adjustment",
      quantity: delta,
      note: why,
    });
    await logActivity(
      ctx,
      userId,
      "Adjusted client empties",
      `${client.name}: ${delta > 0 ? "+" : ""}${delta} ${product.name} (${why})`,
    );
  },
});
