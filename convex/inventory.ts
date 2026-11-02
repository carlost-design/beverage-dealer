import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { cleanText, currentUser, fail, logActivity, requireUser, requireWholeNumber } from "./lib/access";
import { manilaDate } from "./lib/dates";
import { depositNet } from "./lib/money";
import { dayView } from "./lib/dayView";
import {
  availableStock,
  expectedClosing,
  getDayDoc,
  hasLaterDay,
  moveStock,
  openDay,
  recordEmpties,
  recordStockIn,
  stockRow,
} from "./lib/stock";

export const day = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    if (!(await currentUser(ctx))) return null;
    return await dayView(ctx, date);
  },
});

export const recentDays = query({
  args: {},
  handler: async (ctx) => {
    if (!(await currentUser(ctx))) return null;
    const days = await ctx.db.query("inventoryDays").withIndex("by_date").order("desc").take(31);
    const result = [];
    for (const day of days) {
      const rows = await ctx.db
        .query("dailyStock")
        .withIndex("by_date_product", (q) => q.eq("date", day.date))
        .collect();
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_date", (q) => q.eq("date", day.date))
        .collect();
      result.push({
        date: day.date,
        status: day.status,
        counted: day.counted,
        sold: rows.reduce((sum, row) => sum + row.sold, 0),
        stockIn: rows.reduce((sum, row) => sum + row.stockIn, 0),
        closing: rows.reduce((sum, row) => sum + (row.counted ?? expectedClosing(row)), 0),
        variance: rows.reduce(
          (sum, row) => sum + (row.counted === undefined ? 0 : row.counted - expectedClosing(row)),
          0,
        ),
        sales: orders.filter((o) => !o.voided).reduce((sum, o) => sum + o.total - depositNet(o), 0),
      });
    }
    return result;
  },
});

// The day's ledger: every stock and empties movement, newest first.
export const activity = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    if (!(await currentUser(ctx))) return null;
    const productNames = new Map<Id<"products">, string>();
    const clientNames = new Map<Id<"clients">, string>();
    const productName = async (id: Id<"products">) => {
      if (!productNames.has(id)) productNames.set(id, (await ctx.db.get("products", id))?.name ?? "Deleted");
      return productNames.get(id)!;
    };
    const clientName = async (id: Id<"clients">) => {
      if (!clientNames.has(id)) clientNames.set(id, (await ctx.db.get("clients", id))?.name ?? "Deleted");
      return clientNames.get(id)!;
    };

    const stock = await ctx.db
      .query("stockMovements")
      .withIndex("by_date", (q) => q.eq("date", date))
      .collect();
    const empties = await ctx.db
      .query("emptiesMovements")
      .withIndex("by_date", (q) => q.eq("date", date))
      .collect();
    const stockIns = await ctx.db
      .query("stockIns")
      .withIndex("by_date", (q) => q.eq("date", date))
      .collect();

    const stockRowsOut = [];
    for (const move of stock) {
      stockRowsOut.push({ ...move, productName: await productName(move.productId) });
    }
    const emptiesOut = [];
    for (const move of empties) {
      emptiesOut.push({
        ...move,
        productName: await productName(move.productId),
        clientName: move.clientId ? await clientName(move.clientId) : undefined,
      });
    }
    return {
      stock: stockRowsOut.sort((a, b) => b._creationTime - a._creationTime),
      empties: emptiesOut.sort((a, b) => b._creationTime - a._creationTime),
      stockIns: stockIns.sort((a, b) => b._creationTime - a._creationTime),
    };
  },
});

export const startDay = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const day = await openDay(ctx, manilaDate());
    await logActivity(ctx, userId, "Started day", day.date);
  },
});

export const stockIn = mutation({
  args: {
    supplier: v.optional(v.string()),
    reference: v.optional(v.string()),
    items: v.array(
      v.object({ productId: v.id("products"), quantity: v.number(), cost: v.optional(v.number()) }),
    ),
    emptiesReturned: v.array(v.object({ productId: v.id("products"), quantity: v.number() })),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await recordStockIn(ctx, userId, args);
  },
});

export const recordDamage = mutation({
  args: { productId: v.id("products"), quantity: v.number(), note: v.optional(v.string()) },
  handler: async (ctx, { productId, quantity, note }) => {
    const userId = await requireUser(ctx);
    requireWholeNumber(quantity, ["Damaged cases", "sirang kaha"], { min: 1 });
    const product = await ctx.db.get("products", productId);
    if (!product) fail("Product not found.", "Hindi makita ang produkto.");
    const date = manilaDate();
    await openDay(ctx, date);
    const available = await availableStock(ctx, date, productId);
    if (quantity > available) {
      fail(
        `Only ${available} case(s) of ${product.name} are in stock.`,
        `${available} kaha na lang ng ${product.name} ang nasa stock.`,
      );
    }
    await moveStock(ctx, {
      date,
      productId,
      field: "damaged",
      quantity,
      type: "damage",
      note: cleanText(note),
    });
    await logActivity(
      ctx,
      userId,
      "Damaged stock",
      `${quantity} ${product.name}${note ? ` (${note.trim()})` : ""}`,
    );
  },
});

export const adjustStock = mutation({
  args: { productId: v.id("products"), delta: v.number(), note: v.string() },
  handler: async (ctx, { productId, delta, note }) => {
    const userId = await requireUser(ctx);
    if (!Number.isInteger(delta) || delta === 0) {
      fail("Enter a whole number of cases, like 5 or -5.", "Maglagay ng buong bilang ng kaha, halimbawa 5 o -5.");
    }
    const why = cleanText(note);
    if (!why) fail("Enter a reason for the adjustment.", "Ilagay ang dahilan ng pagtama.");
    const product = await ctx.db.get("products", productId);
    if (!product) fail("Product not found.", "Hindi makita ang produkto.");
    const date = manilaDate();
    await openDay(ctx, date);
    const available = await availableStock(ctx, date, productId);
    if (available + delta < 0) {
      fail(
        `Only ${available} case(s) of ${product.name} are in stock.`,
        `${available} kaha na lang ng ${product.name} ang nasa stock.`,
      );
    }
    await moveStock(ctx, { date, productId, field: "adjusted", quantity: delta, type: "adjustment", note: why });
    await logActivity(
      ctx,
      userId,
      "Adjusted stock",
      `${delta > 0 ? "+" : ""}${delta} ${product.name} (${why})`,
    );
  },
});

export const adjustWarehouseEmpties = mutation({
  args: { productId: v.id("products"), delta: v.number(), note: v.string() },
  handler: async (ctx, { productId, delta, note }) => {
    const userId = await requireUser(ctx);
    if (!Number.isInteger(delta) || delta === 0) {
      fail("Enter a whole number of cases, like 5 or -5.", "Maglagay ng buong bilang ng kaha, halimbawa 5 o -5.");
    }
    const why = cleanText(note);
    if (!why) fail("Enter a reason for the adjustment.", "Ilagay ang dahilan ng pagtama.");
    const product = await ctx.db.get("products", productId);
    if (!product?.returnable) fail("Only returnable products have empties.", "Ang mga produktong may ibinabalik na kaha lang ang may empties.");
    if (product.emptiesOnHand + delta < 0) {
      fail(
        `Only ${product.emptiesOnHand} empty case(s) of ${product.name} are in storage.`,
        `${product.emptiesOnHand} bakanteng kaha na lang ng ${product.name} ang nasa bodega.`,
      );
    }
    await recordEmpties(ctx, {
      date: manilaDate(),
      productId,
      type: "warehouse_adjustment",
      quantity: delta,
      note: why,
    });
    await logActivity(
      ctx,
      userId,
      "Adjusted warehouse empties",
      `${delta > 0 ? "+" : ""}${delta} ${product.name} (${why})`,
    );
  },
});

// Saves the physical count. Tomorrow starts from these numbers.
export const closeDay = mutation({
  args: {
    date: v.string(),
    counts: v.array(v.object({ productId: v.id("products"), counted: v.number() })),
  },
  handler: async (ctx, { date, counts }) => {
    const userId = await requireUser(ctx);
    if (date > manilaDate()) fail("You can't close a day that hasn't happened yet.", "Hindi puwedeng isara ang araw na hindi pa dumarating.");
    const existing = await getDayDoc(ctx, date);
    if (existing?.status === "closed") fail("This day is already closed.", "Sarado na ang araw na ito.");
    const day = existing ?? (await openDay(ctx, date));
    if (await hasLaterDay(ctx, date)) {
      fail("A later day has already started, so this day can't be closed.", "Nagsimula na ang sumunod na araw kaya hindi na ito maisasara.");
    }

    const countByProduct = new Map(counts.map((c) => [c.productId, c.counted]));
    const rows = await ctx.db
      .query("dailyStock")
      .withIndex("by_date_product", (q) => q.eq("date", date))
      .collect();
    // Products that had no activity yet today still get a row, so their count carries over.
    for (const productId of countByProduct.keys()) {
      if (!rows.some((row) => row.productId === productId)) rows.push(await stockRow(ctx, date, productId));
    }

    const variances = [];
    for (const row of rows) {
      const expected = expectedClosing(row);
      const counted = countByProduct.get(row.productId) ?? expected;
      requireWholeNumber(counted, ["Physical count", "bilang"]);
      await ctx.db.patch("dailyStock", row._id, { counted });
      if (counted !== expected) {
        const product = await ctx.db.get("products", row.productId);
        variances.push(`${product?.name ?? "?"} ${counted > expected ? "+" : ""}${counted - expected}`);
      }
    }
    await ctx.db.patch("inventoryDays", day._id, { status: "closed", counted: true, closedAt: Date.now() });
    await logActivity(
      ctx,
      userId,
      "Closed day",
      `${date}: ${variances.length ? `variance ${variances.join(", ")}` : "count matched"}`,
    );
  },
});

export const reopenDay = mutation({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const userId = await requireUser(ctx);
    const day = await getDayDoc(ctx, date);
    if (!day || day.status !== "closed") fail("This day isn't closed.", "Hindi pa sarado ang araw na ito.");
    if (await hasLaterDay(ctx, date)) {
      fail("A later day has already started, so this day can't be reopened.", "Nagsimula na ang sumunod na araw kaya hindi na ito mabubuksan ulit.");
    }
    const rows = await ctx.db
      .query("dailyStock")
      .withIndex("by_date_product", (q) => q.eq("date", date))
      .collect();
    for (const row of rows) await ctx.db.patch("dailyStock", row._id, { counted: undefined });
    await ctx.db.patch("inventoryDays", day._id, { status: "open", counted: false, closedAt: undefined });
    await logActivity(ctx, userId, "Reopened day", date);
  },
});
