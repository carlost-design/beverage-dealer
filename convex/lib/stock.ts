import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { fail } from "./access";

type StockCounts = Pick<
  Doc<"dailyStock">,
  "starting" | "stockIn" | "sold" | "returned" | "damaged" | "adjusted"
>;

export function expectedClosing(row: StockCounts): number {
  return row.starting + row.stockIn - row.sold + row.returned - row.damaged + row.adjusted;
}

// The physical count wins when there is one.
export function closingOf(row: Doc<"dailyStock">): number {
  return row.counted ?? expectedClosing(row);
}

export async function getDayDoc(ctx: QueryCtx, date: string) {
  return await ctx.db
    .query("inventoryDays")
    .withIndex("by_date", (q) => q.eq("date", date))
    .unique();
}

export async function latestDayBefore(ctx: QueryCtx, date: string) {
  return await ctx.db
    .query("inventoryDays")
    .withIndex("by_date", (q) => q.lt("date", date))
    .order("desc")
    .first();
}

export async function hasLaterDay(ctx: QueryCtx, date: string) {
  const later = await ctx.db
    .query("inventoryDays")
    .withIndex("by_date", (q) => q.gt("date", date))
    .first();
  return later !== null;
}

// A product's starting stock is the closing of its most recent earlier day.
export async function carriedStock(ctx: QueryCtx, productId: Id<"products">, date: string) {
  const previous = await ctx.db
    .query("dailyStock")
    .withIndex("by_product_date", (q) => q.eq("productId", productId).lt("date", date))
    .order("desc")
    .first();
  return previous ? closingOf(previous) : 0;
}

async function insertStockRow(
  ctx: MutationCtx,
  date: string,
  productId: Id<"products">,
  starting: number,
) {
  const id = await ctx.db.insert("dailyStock", {
    date,
    productId,
    starting,
    stockIn: 0,
    sold: 0,
    returned: 0,
    damaged: 0,
    adjusted: 0,
  });
  return (await ctx.db.get("dailyStock", id))!;
}

// Opens a business day and carries over every product's closing stock. If the
// previous day was left open, it is closed here with the system's expected
// numbers and flagged as not counted.
export async function openDay(ctx: MutationCtx, date: string): Promise<Doc<"inventoryDays">> {
  const existing = await getDayDoc(ctx, date);
  if (existing) {
    if (existing.status === "closed") {
      fail(
        "Today is already closed. Open it again on the Stock page to make changes.",
        "Sarado na ang araw na ito. Buksan ulit sa Stock page para makapagbago.",
      );
    }
    return existing;
  }
  if (await hasLaterDay(ctx, date)) {
    fail("A later business day has already started. Check the device's date.", "Nagsimula na ang sumunod na araw. Tingnan ang petsa ng device.");
  }

  const previous = await latestDayBefore(ctx, date);
  if (previous && previous.status === "open") {
    await ctx.db.patch("inventoryDays", previous._id, {
      status: "closed",
      counted: false,
      closedAt: Date.now(),
    });
  }

  const dayId = await ctx.db.insert("inventoryDays", { date, status: "open", counted: false });
  for (const product of await ctx.db.query("products").collect()) {
    const starting = await carriedStock(ctx, product._id, date);
    if (!product.active && starting === 0) continue;
    await insertStockRow(ctx, date, product._id, starting);
  }
  return (await ctx.db.get("inventoryDays", dayId))!;
}

export async function stockRow(ctx: MutationCtx, date: string, productId: Id<"products">) {
  const row = await ctx.db
    .query("dailyStock")
    .withIndex("by_date_product", (q) => q.eq("date", date).eq("productId", productId))
    .unique();
  if (row) return row;
  return await insertStockRow(ctx, date, productId, await carriedStock(ctx, productId, date));
}

// How each column moves the stock level.
const FIELD_SIGN = { stockIn: 1, sold: -1, returned: 1, damaged: -1, adjusted: 1 } as const;
export type StockField = keyof typeof FIELD_SIGN;

export async function moveStock(
  ctx: MutationCtx,
  move: {
    date: string;
    productId: Id<"products">;
    field: StockField;
    quantity: number; // added to the column; negative undoes an earlier move
    type: Doc<"stockMovements">["type"];
    orderId?: Id<"orders">;
    stockInId?: Id<"stockIns">;
    note?: string;
  },
) {
  if (move.quantity === 0) return;
  const row = await stockRow(ctx, move.date, move.productId);
  const patch: Partial<Record<StockField, number>> = {};
  patch[move.field] = row[move.field] + move.quantity;
  await ctx.db.patch("dailyStock", row._id, patch);
  await ctx.db.insert("stockMovements", {
    date: move.date,
    productId: move.productId,
    type: move.type,
    quantity: FIELD_SIGN[move.field] * move.quantity,
    orderId: move.orderId,
    stockInId: move.stockInId,
    note: move.note,
  });
}

export async function availableStock(ctx: MutationCtx, date: string, productId: Id<"products">) {
  return expectedClosing(await stockRow(ctx, date, productId));
}

// Effect of each empties movement on what the client owes and on the
// warehouse count.
const EMPTIES_EFFECT = {
  issued: { client: 1, warehouse: 0 },
  client_return: { client: -1, warehouse: 1 },
  client_adjustment: { client: 1, warehouse: 0 },
  to_supplier: { client: 0, warehouse: -1 },
  warehouse_adjustment: { client: 0, warehouse: 1 },
} as const;

export async function recordEmpties(
  ctx: MutationCtx,
  move: {
    date: string;
    productId: Id<"products">;
    clientId?: Id<"clients">;
    type: Doc<"emptiesMovements">["type"];
    quantity: number; // negative undoes an earlier movement
    orderId?: Id<"orders">;
    stockInId?: Id<"stockIns">;
    note?: string;
  },
) {
  if (move.quantity === 0) return;
  const effect = EMPTIES_EFFECT[move.type];

  if (effect.client !== 0) {
    const clientId = move.clientId;
    if (!clientId) throw new Error(`Empties movement "${move.type}" needs a client.`);
    const row = await ctx.db
      .query("clientEmpties")
      .withIndex("by_client_product", (q) =>
        q.eq("clientId", clientId).eq("productId", move.productId),
      )
      .unique();
    const delta = effect.client * move.quantity;
    if (row) await ctx.db.patch("clientEmpties", row._id, { owed: row.owed + delta });
    else await ctx.db.insert("clientEmpties", { clientId, productId: move.productId, owed: delta });
  }

  if (effect.warehouse !== 0) {
    const product = await ctx.db.get("products", move.productId);
    if (!product) fail("Product not found.", "Hindi makita ang produkto.");
    const next = product.emptiesOnHand + effect.warehouse * move.quantity;
    if (move.type === "to_supplier" && next < 0) {
      fail(
        `Only ${product.emptiesOnHand} empty case(s) of ${product.name} are in storage.`,
        `${product.emptiesOnHand} bakanteng kaha na lang ng ${product.name} ang nasa bodega.`,
      );
    }
    await ctx.db.patch("products", product._id, { emptiesOnHand: next });
  }

  await ctx.db.insert("emptiesMovements", move);
}
