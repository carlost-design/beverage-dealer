import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { cleanText, currentUser, fail, logActivity, requireUser } from "./lib/access";
import { manilaDate } from "./lib/dates";
import { METHOD_LABELS } from "./lib/labels";
import { formatPeso, paymentStatusFor } from "./lib/money";
import { addPayment, openOrdersForClient } from "./lib/orders";
import { paymentMethod } from "./schema";

export const record = mutation({
  args: {
    orderId: v.id("orders"),
    amount: v.number(),
    method: paymentMethod,
    reference: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { orderId, ...payment }) => {
    const userId = await requireUser(ctx);
    const order = await ctx.db.get("orders", orderId);
    if (!order) fail("Order not found.", "Hindi makita ang order.");
    await addPayment(ctx, order, { ...payment, date: manilaDate() });
    await logActivity(
      ctx,
      userId,
      "Recorded payment",
      `${formatPeso(payment.amount)} ${METHOD_LABELS[payment.method]} for order #${order.orderNo}`,
    );
  },
});

// One payment from a client spread over their unpaid orders, oldest due first.
export const receiveForClient = mutation({
  args: {
    clientId: v.id("clients"),
    amount: v.number(),
    method: paymentMethod,
    reference: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { clientId, amount, ...rest }) => {
    const userId = await requireUser(ctx);
    const client = await ctx.db.get("clients", clientId);
    if (!client) fail("Client not found.", "Hindi makita ang suki.");
    if (!Number.isInteger(amount) || amount <= 0) {
      fail("Enter an amount greater than zero.", "Maglagay ng halagang higit sa zero.");
    }
    const orders = await openOrdersForClient(ctx, clientId);
    const balance = orders.reduce((sum, order) => sum + order.total - order.amountPaid, 0);
    if (amount > balance) {
      fail(
        `${client.name}'s total utang is only ${formatPeso(balance)}.`,
        `${formatPeso(balance)} lang ang kabuuang utang ni ${client.name}.`,
      );
    }

    const date = manilaDate();
    let remaining = amount;
    const applied: { orderNo: number; amount: number }[] = [];
    for (const order of orders) {
      if (remaining === 0) break;
      const pay = Math.min(remaining, order.total - order.amountPaid);
      await addPayment(ctx, order, { ...rest, amount: pay, date });
      applied.push({ orderNo: order.orderNo, amount: pay });
      remaining -= pay;
    }
    await logActivity(
      ctx,
      userId,
      "Recorded payment",
      `${formatPeso(amount)} ${METHOD_LABELS[rest.method]} from ${client.name} for ${applied
        .map((a) => `#${a.orderNo}`)
        .join(", ")}`,
    );
    return applied;
  },
});

export const voidPayment = mutation({
  args: { paymentId: v.id("payments"), reason: v.string() },
  handler: async (ctx, { paymentId, reason }) => {
    const userId = await requireUser(ctx);
    const payment = await ctx.db.get("payments", paymentId);
    if (!payment || payment.voided) fail("Payment not found.", "Hindi makita ang bayad.");
    const why = cleanText(reason);
    if (!why) fail("Enter a reason for removing this payment.", "Ilagay ang dahilan ng pagtanggal ng bayad.");
    const order = await ctx.db.get("orders", payment.orderId);
    if (!order) fail("Order not found.", "Hindi makita ang order.");

    await ctx.db.patch("payments", payment._id, { voided: true, voidReason: why });
    const amountPaid = order.amountPaid - payment.amount;
    const paymentStatus = paymentStatusFor(order.total, amountPaid);
    await ctx.db.patch("orders", order._id, {
      amountPaid,
      paymentStatus,
      paidDate: paymentStatus === "paid" ? order.paidDate : undefined,
    });
    await logActivity(
      ctx,
      userId,
      "Removed payment",
      `${formatPeso(payment.amount)} ${METHOD_LABELS[payment.method]} from order #${order.orderNo}: ${why}`,
    );
  },
});

// Collections received on a day, with the order and client they belong to.
export const listByDate = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    if (!(await currentUser(ctx))) return null;
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_date", (q) => q.eq("date", date))
      .collect();
    const clients = new Map<Id<"clients">, string>();
    const rows = [];
    for (const payment of payments.filter((p) => !p.voided)) {
      if (!clients.has(payment.clientId)) {
        clients.set(payment.clientId, (await ctx.db.get("clients", payment.clientId))?.name ?? "");
      }
      const order = await ctx.db.get("orders", payment.orderId);
      rows.push({
        ...payment,
        clientName: clients.get(payment.clientId)!,
        orderNo: order?.orderNo ?? 0,
        orderDate: order?.date ?? "",
      });
    }
    return rows.sort((a, b) => b._creationTime - a._creationTime);
  },
});
