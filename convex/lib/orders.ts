import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { cleanText, fail, requireWholeNumber } from "./access";
import { addDays, daysBetween } from "./dates";
import { discountAmount, formatPeso, lineAmount, paymentStatusFor } from "./money";
import { availableStock, moveStock, openDay, recordEmpties } from "./stock";

export type OrderItem = Doc<"orders">["items"][number];
export type ItemInput = {
  productId: Id<"products">;
  quantity: number;
  emptiesReturned: number;
  discountPerCase?: number;
};
export type PaymentInput = {
  amount: number;
  method: Doc<"payments">["method"];
  reference?: string;
  note?: string;
};
export type OrderInput = {
  clientId: Id<"clients">;
  fulfillment: Doc<"orders">["fulfillment"];
  completed?: boolean;
  deliveryAddress?: string;
  items: ItemInput[];
  notes?: string;
  payment?: PaymentInput;
};

// Merges duplicate lines and snapshots prices. Lines already on the order keep
// the price they were sold at.
export async function buildItems(
  ctx: QueryCtx,
  inputs: ItemInput[],
  existing: OrderItem[] = [],
): Promise<OrderItem[]> {
  const merged = new Map<Id<"products">, { quantity: number; emptiesReturned: number; discountPerCase: number }>();
  for (const input of inputs) {
    requireWholeNumber(input.quantity, ["Quantity", "dami"]);
    requireWholeNumber(input.emptiesReturned, ["Empties returned", "empties na ibinalik"]);
    requireWholeNumber(input.discountPerCase ?? 0, ["Discount", "discount"]);
    const line = merged.get(input.productId) ?? { quantity: 0, emptiesReturned: 0, discountPerCase: 0 };
    merged.set(input.productId, {
      quantity: line.quantity + input.quantity,
      emptiesReturned: line.emptiesReturned + input.emptiesReturned,
      discountPerCase: input.discountPerCase ?? line.discountPerCase,
    });
  }

  const items: OrderItem[] = [];
  for (const [productId, line] of merged) {
    const product = await ctx.db.get("products", productId);
    if (!product) fail("A product in this order no longer exists.", "Wala na ang isang produkto sa order na ito.");
    const previous = existing.find((item) => item.productId === productId);
    const emptiesReturned = product.returnable ? line.emptiesReturned : 0;
    if (line.quantity === 0 && emptiesReturned === 0) continue;
    const price = previous?.price ?? product.price;
    if (line.discountPerCase > price) {
      fail(
        `The discount on ${product.name} is more than its price.`,
        `Mas malaki ang discount sa ${product.name} kaysa sa presyo nito.`,
      );
    }
    items.push({
      productId,
      name: product.name,
      price,
      cost: previous?.cost ?? product.cost,
      quantity: line.quantity,
      returnable: product.returnable,
      emptiesReturned,
      discountPerCase: line.discountPerCase > 0 ? line.discountPerCase : undefined,
    });
  }
  if (!items.some((item) => item.quantity > 0)) {
    fail("Add at least one case to the order.", "Magdagdag ng kahit isang kaha sa order.");
  }
  return items;
}

type OrderDiscount = NonNullable<Doc<"orders">["discount"]>;

// The whole-order discount only exists on older orders; it is recalculated
// when one of them is edited.
export function orderTotals(items: OrderItem[], oldDiscount?: OrderDiscount) {
  const subtotal = items.reduce((sum, item) => sum + lineAmount(item), 0);
  const cases = items.reduce((sum, item) => sum + item.quantity, 0);
  const amount = discountAmount(oldDiscount, subtotal, cases);
  return {
    subtotal,
    discount: oldDiscount ? { ...oldDiscount, amount } : undefined,
    total: subtotal - amount,
  };
}

async function assertStock(
  ctx: MutationCtx,
  date: string,
  items: OrderItem[],
  alreadyDeducted: OrderItem[],
) {
  for (const item of items) {
    if (item.quantity === 0) continue;
    const onOrder = alreadyDeducted.find((line) => line.productId === item.productId)?.quantity ?? 0;
    const available = (await availableStock(ctx, date, item.productId)) + onOrder;
    if (item.quantity > available) {
      fail(
        `Not enough stock for ${item.name}: only ${Math.max(available, 0)} case(s) left.`,
        `Kulang ang stock ng ${item.name}: ${Math.max(available, 0)} kaha na lang.`,
      );
    }
  }
}

async function nextOrderNo(ctx: MutationCtx) {
  const counter = await ctx.db
    .query("counters")
    .withIndex("by_name", (q) => q.eq("name", "orderNo"))
    .unique();
  if (!counter) {
    await ctx.db.insert("counters", { name: "orderNo", value: 1001 });
    return 1001;
  }
  const value = counter.value + 1;
  await ctx.db.patch("counters", counter._id, { value });
  return value;
}

function byProduct(items: OrderItem[]) {
  return new Map(items.map((item) => [item.productId, item]));
}

// Moves stock by the difference between two versions of an order's items.
export async function applyStockChanges(
  ctx: MutationCtx,
  date: string,
  order: Doc<"orders">,
  before: OrderItem[],
  after: OrderItem[],
) {
  const oldItems = byProduct(before);
  const newItems = byProduct(after);
  for (const productId of new Set([...oldItems.keys(), ...newItems.keys()])) {
    const delta = (newItems.get(productId)?.quantity ?? 0) - (oldItems.get(productId)?.quantity ?? 0);
    await moveStock(ctx, {
      date,
      productId,
      field: "sold",
      quantity: delta,
      type: delta > 0 ? "sale" : "sale_void",
      orderId: order._id,
      note: `Order #${order.orderNo}`,
    });
  }
}

// Same idea for empties: full returnable cases out mean empties owed, and
// empties brought back reduce what the client owes.
export async function applyEmptiesChanges(
  ctx: MutationCtx,
  date: string,
  order: Doc<"orders">,
  before: OrderItem[],
  after: OrderItem[],
) {
  const oldItems = byProduct(before);
  const newItems = byProduct(after);
  const issued = (item?: OrderItem) => (item?.returnable ? item.quantity : 0);
  const returned = (item?: OrderItem) => (item?.returnable ? item.emptiesReturned : 0);
  for (const productId of new Set([...oldItems.keys(), ...newItems.keys()])) {
    const oldItem = oldItems.get(productId);
    const newItem = newItems.get(productId);
    const common = { date, productId, clientId: order.clientId, orderId: order._id, note: `Order #${order.orderNo}` };
    await recordEmpties(ctx, { ...common, type: "issued", quantity: issued(newItem) - issued(oldItem) });
    await recordEmpties(ctx, {
      ...common,
      type: "client_return",
      quantity: returned(newItem) - returned(oldItem),
    });
  }
}

export async function addPayment(
  ctx: MutationCtx,
  order: Doc<"orders">,
  payment: PaymentInput & { date: string },
) {
  if (order.voided) fail("This order was cancelled.", "Kinansela na ang order na ito.");
  requireWholeNumber(payment.amount, ["Amount", "halaga"], { min: 1 });
  const balance = order.total - order.amountPaid;
  if (payment.amount > balance) {
    fail(
      `The amount is more than the balance of ${formatPeso(balance)}.`,
      `Mas malaki ang halaga kaysa sa balanseng ${formatPeso(balance)}.`,
    );
  }
  const paymentId = await ctx.db.insert("payments", {
    orderId: order._id,
    clientId: order.clientId,
    amount: payment.amount,
    method: payment.method,
    reference: cleanText(payment.reference),
    note: cleanText(payment.note),
    date: payment.date,
    voided: false,
  });
  const amountPaid = order.amountPaid + payment.amount;
  const paymentStatus = paymentStatusFor(order.total, amountPaid);
  await ctx.db.patch("orders", order._id, {
    amountPaid,
    paymentStatus,
    paidDate: paymentStatus === "paid" ? payment.date : undefined,
  });
  return paymentId;
}

export async function createOrder(ctx: MutationCtx, date: string, input: OrderInput) {
  const client = await ctx.db.get("clients", input.clientId);
  if (!client || !client.active) fail("Choose an active client.", "Pumili ng suki.");
  await openDay(ctx, date);

  const items = await buildItems(ctx, input.items);
  await assertStock(ctx, date, items, []);
  const totals = orderTotals(items);
  const orderId = await ctx.db.insert("orders", {
    orderNo: await nextOrderNo(ctx),
    date,
    clientId: client._id,
    fulfillment: input.fulfillment,
    fulfillmentStatus: input.completed ? "completed" : "pending",
    deliveryAddress:
      input.fulfillment === "delivery"
        ? (cleanText(input.deliveryAddress) ?? client.address)
        : undefined,
    items,
    subtotal: totals.subtotal,
    total: totals.total,
    amountPaid: 0,
    paymentStatus: paymentStatusFor(totals.total, 0),
    paidDate: totals.total === 0 ? date : undefined,
    dueDate: addDays(date, client.termsDays),
    notes: cleanText(input.notes),
    voided: false,
  });
  const order = (await ctx.db.get("orders", orderId))!;
  await applyStockChanges(ctx, date, order, [], items);
  await applyEmptiesChanges(ctx, date, order, [], items);
  if (input.payment && input.payment.amount > 0) {
    await addPayment(ctx, order, { ...input.payment, date });
  }
  return { order, client };
}

export async function updateOrderItems(
  ctx: MutationCtx,
  order: Doc<"orders">,
  date: string,
  inputs: ItemInput[],
) {
  await openDay(ctx, date);
  const items = await buildItems(ctx, inputs, order.items);
  await assertStock(ctx, date, items, order.items);
  const totals = orderTotals(items, order.discount);
  if (totals.total < order.amountPaid) {
    fail(
      `This order already has ${formatPeso(order.amountPaid)} in payments, which is more than the new total. Remove a payment first.`,
      `May ${formatPeso(order.amountPaid)} nang bayad ang order, mas malaki sa bagong total. Tanggalin muna ang isang bayad.`,
    );
  }
  await applyStockChanges(ctx, date, order, order.items, items);
  await applyEmptiesChanges(ctx, date, order, order.items, items);
  const paymentStatus = paymentStatusFor(totals.total, order.amountPaid);
  await ctx.db.patch("orders", order._id, {
    items,
    subtotal: totals.subtotal,
    discount: totals.discount,
    total: totals.total,
    paymentStatus,
    paidDate: paymentStatus === "paid" ? (order.paidDate ?? date) : undefined,
  });
  return totals;
}

export function lateInfo(
  order: Pick<Doc<"orders">, "paymentStatus" | "dueDate" | "voided">,
  today: string,
) {
  if (order.voided || order.paymentStatus === "paid" || order.dueDate >= today) {
    return { isLate: false, daysLate: 0 };
  }
  return { isLate: true, daysLate: daysBetween(order.dueDate, today) };
}

// Orders with a balance: unpaid or partially paid, and not voided.
export async function openOrders(ctx: QueryCtx) {
  const unpaid = await ctx.db
    .query("orders")
    .withIndex("by_status_due", (q) => q.eq("paymentStatus", "unpaid"))
    .collect();
  const partial = await ctx.db
    .query("orders")
    .withIndex("by_status_due", (q) => q.eq("paymentStatus", "partial"))
    .collect();
  return [...unpaid, ...partial].filter((order) => !order.voided);
}

export async function openOrdersForClient(ctx: QueryCtx, clientId: Id<"clients">) {
  const unpaid = await ctx.db
    .query("orders")
    .withIndex("by_client_status", (q) => q.eq("clientId", clientId).eq("paymentStatus", "unpaid"))
    .collect();
  const partial = await ctx.db
    .query("orders")
    .withIndex("by_client_status", (q) => q.eq("clientId", clientId).eq("paymentStatus", "partial"))
    .collect();
  return [...unpaid, ...partial]
    .filter((order) => !order.voided)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.orderNo - b.orderNo);
}
