import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { cleanText, currentUser, fail, logActivity, requireUser } from "./lib/access";
import { manilaDate } from "./lib/dates";
import { formatPeso } from "./lib/money";
import {
  applyEmptiesChanges,
  applyStockChanges,
  createOrder,
  lateInfo,
  openOrders,
  openOrdersForClient,
  updateOrderItems,
} from "./lib/orders";
import { getDayDoc, moveStock, openDay } from "./lib/stock";
import { paymentMethod } from "./schema";

const itemInput = v.object({
  productId: v.id("products"),
  quantity: v.number(),
  emptiesReturned: v.number(),
  discountPerCase: v.optional(v.number()),
});
const fulfillment = v.union(v.literal("delivery"), v.literal("pickup"));

// Clients with at least one overdue order. Their name shows in red on every
// order, not only on the late one.
async function lateClientIds(ctx: QueryCtx, today: string) {
  const late = new Set<Id<"clients">>();
  for (const order of await openOrders(ctx)) {
    if (lateInfo(order, today).isLate) late.add(order.clientId);
  }
  return late;
}

async function summarize(ctx: QueryCtx, orders: Doc<"orders">[], today: string) {
  const clients = new Map<Id<"clients">, Doc<"clients"> | null>();
  const lateClients = await lateClientIds(ctx, today);
  const rows = [];
  for (const order of orders) {
    if (!clients.has(order.clientId)) {
      clients.set(order.clientId, await ctx.db.get("clients", order.clientId));
    }
    const client = clients.get(order.clientId);
    rows.push({
      _id: order._id,
      _creationTime: order._creationTime,
      orderNo: order.orderNo,
      date: order.date,
      clientId: order.clientId,
      clientName: client?.name ?? "Deleted client",
      storeName: client?.storeName,
      clientIsLate: lateClients.has(order.clientId),
      fulfillment: order.fulfillment,
      fulfillmentStatus: order.fulfillmentStatus,
      cases: order.items.reduce((sum, item) => sum + item.quantity, 0),
      total: order.total,
      amountPaid: order.amountPaid,
      paymentStatus: order.paymentStatus,
      dueDate: order.dueDate,
      voided: order.voided,
      ...lateInfo(order, today),
    });
  }
  return rows;
}

export type OrderRow = Awaited<ReturnType<typeof summarize>>[number];

async function getActiveOrder(ctx: QueryCtx, orderId: Id<"orders">) {
  const order = await ctx.db.get("orders", orderId);
  if (!order) fail("Order not found.", "Hindi makita ang order.");
  if (order.voided) fail("This order was cancelled.", "Kinansela na ang order na ito.");
  return order;
}

export const get = query({
  args: { orderId: v.string(), today: v.string() },
  handler: async (ctx, { orderId, today }) => {
    if (!(await currentUser(ctx))) return null;
    const id = ctx.db.normalizeId("orders", orderId);
    const order = id ? await ctx.db.get("orders", id) : null;
    if (!order) return null;
    const client = await ctx.db.get("clients", order.clientId);
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    const day = await getDayDoc(ctx, order.date);
    const clientOrders = await openOrdersForClient(ctx, order.clientId);
    return {
      order,
      client,
      clientIsLate: clientOrders.some((o) => lateInfo(o, today).isLate),
      payments: payments.sort((a, b) => b._creationTime - a._creationTime),
      canEditItems: !order.voided && order.date === today && day?.status !== "closed",
      ...lateInfo(order, today),
    };
  },
});

export const listByDate = query({
  args: { date: v.string(), today: v.string() },
  handler: async (ctx, { date, today }) => {
    if (!(await currentUser(ctx))) return null;
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_date", (q) => q.eq("date", date))
      .order("desc")
      .collect();
    return await summarize(ctx, orders, today);
  },
});

// Everything with a balance, most overdue first.
export const listOpen = query({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    if (!(await currentUser(ctx))) return null;
    const rows = await summarize(ctx, await openOrders(ctx), today);
    return rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.orderNo - b.orderNo);
  },
});

export const listRecent = query({
  args: { paginationOpts: paginationOptsValidator, today: v.string() },
  handler: async (ctx, { paginationOpts, today }) => {
    if (!(await currentUser(ctx))) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const result = await ctx.db.query("orders").order("desc").paginate(paginationOpts);
    return { ...result, page: await summarize(ctx, result.page, today) };
  },
});

export const findByNumber = query({
  args: { orderNo: v.number() },
  handler: async (ctx, { orderNo }) => {
    if (!(await currentUser(ctx))) return null;
    const order = await ctx.db
      .query("orders")
      .withIndex("by_orderNo", (q) => q.eq("orderNo", orderNo))
      .unique();
    return order?._id ?? null;
  },
});

export const create = mutation({
  args: {
    clientId: v.id("clients"),
    fulfillment,
    completed: v.optional(v.boolean()),
    deliveryAddress: v.optional(v.string()),
    items: v.array(itemInput),
    // Also remember these per-case discounts for the client's next orders.
    saveDiscount: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    payment: v.optional(
      v.object({
        amount: v.number(),
        method: paymentMethod,
        reference: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { saveDiscount, ...args }) => {
    const userId = await requireUser(ctx);
    const { order, client } = await createOrder(ctx, manilaDate(), args);
    const saved = (await ctx.db.get("orders", order._id))!;
    const usual = new Map((client.productDiscounts ?? []).map((d) => [d.productId, d.perCase]));
    const discounted = saved.items.filter((item) => item.discountPerCase);
    const discount = discounted.length
      ? `, discount ${discounted.map((item) => `${item.name} ${formatPeso(item.discountPerCase!)}/case`).join(", ")}`
      : "";
    const changes = saved.items.filter(
      (item) => item.quantity > 0 && (item.discountPerCase ?? 0) !== (usual.get(item.productId) ?? 0),
    );
    await logActivity(
      ctx,
      userId,
      "Created order",
      `Order #${saved.orderNo} for ${client.name}: ${formatPeso(saved.total)}${discount}${
        changes.length && !saveDiscount ? " (this order only)" : ""
      }`,
    );
    if (saveDiscount && changes.length) {
      const before = changes.map((item) => `${item.name} ${formatPeso(usual.get(item.productId) ?? 0)}`);
      for (const item of changes) usual.set(item.productId, item.discountPerCase ?? 0);
      await ctx.db.patch("clients", client._id, {
        productDiscounts: [...usual]
          .filter(([, perCase]) => perCase > 0)
          .map(([productId, perCase]) => ({ productId, perCase })),
      });
      await logActivity(
        ctx,
        userId,
        "Changed usual discount",
        `${client.name}: ${changes
          .map((item, i) => `${before[i]} → ${formatPeso(item.discountPerCase ?? 0)}`)
          .join(", ")} per case (from order #${saved.orderNo})`,
      );
    }
    return saved._id;
  },
});

export const update = mutation({
  args: {
    orderId: v.id("orders"),
    items: v.array(itemInput),
  },
  handler: async (ctx, { orderId, items }) => {
    const userId = await requireUser(ctx);
    const order = await getActiveOrder(ctx, orderId);
    const today = manilaDate();
    if (order.date !== today) {
      fail(
        "Only today's orders can be changed. Cancel this order and make a new one instead.",
        "Ang mga order lang ngayong araw ang puwedeng baguhin. I-cancel ito at gumawa ng bagong order.",
      );
    }
    const totals = await updateOrderItems(ctx, order, today, items);
    await logActivity(
      ctx,
      userId,
      "Edited order",
      `Order #${order.orderNo}: ${formatPeso(order.total)} → ${formatPeso(totals.total)}`,
    );
  },
});

export const updateDetails = mutation({
  args: {
    orderId: v.id("orders"),
    fulfillment,
    deliveryAddress: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { orderId, fulfillment, deliveryAddress, notes }) => {
    await requireUser(ctx);
    const order = await getActiveOrder(ctx, orderId);
    await ctx.db.patch("orders", order._id, {
      fulfillment,
      // Pickup orders can't be "out for delivery".
      fulfillmentStatus:
        fulfillment === "pickup" && order.fulfillmentStatus === "out_for_delivery"
          ? "pending"
          : order.fulfillmentStatus,
      deliveryAddress: fulfillment === "delivery" ? cleanText(deliveryAddress) : undefined,
      notes: cleanText(notes),
    });
  },
});

export const setFulfillmentStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: v.union(v.literal("pending"), v.literal("out_for_delivery"), v.literal("completed")),
  },
  handler: async (ctx, { orderId, status }) => {
    await requireUser(ctx);
    const order = await getActiveOrder(ctx, orderId);
    if (status === "out_for_delivery" && order.fulfillment !== "delivery") {
      fail("Only delivery orders can be out for delivery.", "Ang order na ide-deliver lang ang puwedeng markahang papunta na.");
    }
    await ctx.db.patch("orders", order._id, { fulfillmentStatus: status });
  },
});

// Puts the stock and empties back. Stock from an earlier day comes back into
// today's inventory as a return.
export const voidOrder = mutation({
  args: { orderId: v.id("orders"), reason: v.string() },
  handler: async (ctx, { orderId, reason }) => {
    const userId = await requireUser(ctx);
    const order = await getActiveOrder(ctx, orderId);
    const why = cleanText(reason);
    if (!why) fail("Enter a reason for cancelling this order.", "Ilagay ang dahilan ng pag-cancel.");
    if (order.amountPaid > 0) {
      fail(
        `This order has ${formatPeso(order.amountPaid)} in payments. Remove the payments first, then cancel the order.`,
        `May ${formatPeso(order.amountPaid)} nang bayad ang order na ito. Tanggalin muna ang mga bayad bago i-cancel.`,
      );
    }
    const today = manilaDate();
    await openDay(ctx, today);
    if (order.date === today) {
      await applyStockChanges(ctx, today, order, order.items, []);
    } else {
      for (const item of order.items) {
        await moveStock(ctx, {
          date: today,
          productId: item.productId,
          field: "returned",
          quantity: item.quantity,
          type: "return",
          orderId: order._id,
          note: `Voided order #${order.orderNo} from ${order.date}`,
        });
      }
    }
    await applyEmptiesChanges(ctx, today, order, order.items, []);
    await ctx.db.patch("orders", order._id, { voided: true, voidReason: why });
    await logActivity(
      ctx,
      userId,
      "Voided order",
      `Order #${order.orderNo} (${formatPeso(order.total)}): ${why}`,
    );
  },
});
