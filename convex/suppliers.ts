import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { cleanText, currentUser, fail, logActivity, requireUser, requireWholeNumber } from "./lib/access";
import { isValidDate, manilaDate } from "./lib/dates";
import { formatPeso, lineAmount } from "./lib/money";
import { compareProducts, groupRanks, listGroups } from "./lib/productGroups";
import { recordStockIn } from "./lib/stock";
import { checkWarning, computePurchase, supplierOf } from "./lib/suppliers";
import { checkStatus, supplierKey } from "./schema";

export const SUPPLIER_NAMES = { coke: "Coke", sanMiguel: "San Miguel" } as const;

// Everything on a supplier's tab: its products, recent purchases and its checks.
export const overview = query({
  args: { supplier: supplierKey, today: v.string() },
  handler: async (ctx, { supplier, today }) => {
    if (!(await currentUser(ctx))) return null;
    const products = (await ctx.db.query("products").collect())
      .filter((p) => p.active && supplierOf(p) === supplier)
      .sort((a, b) => a.name.localeCompare(b.name));
    // Every purchase not yet in stock, so it can still be added, plus the
    // latest ones.
    const unstocked = await ctx.db
      .query("supplierPurchases")
      .withIndex("by_supplier_stock", (q) => q.eq("supplier", supplier).eq("stockInId", undefined))
      .collect();
    const recent = await ctx.db
      .query("supplierPurchases")
      .withIndex("by_supplier_date", (q) => q.eq("supplier", supplier))
      .order("desc")
      .take(30);
    const purchases = [...new Map([...unstocked, ...recent].map((p) => [p._id, p])).values()].sort(
      (a, b) => b.date.localeCompare(a.date) || b._creationTime - a._creationTime,
    );
    // Every check not yet cleared, soonest due first, then the latest others.
    const pending = await ctx.db
      .query("supplierChecks")
      .withIndex("by_status", (q) => q.eq("status", "pending").eq("supplier", supplier))
      .collect();
    const history = await ctx.db
      .query("supplierChecks")
      .withIndex("by_supplier_due", (q) => q.eq("supplier", supplier))
      .order("desc")
      .take(50);
    const checks = [
      ...pending.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      ...history.filter((check) => check.status !== "pending"),
    ];
    return {
      products: products.map((p) => ({
        _id: p._id,
        name: p.name,
        category: p.category,
        cost: p.cost,
        returnable: p.returnable,
        emptyValue: p.emptyValue ?? 0,
      })),
      purchases,
      checks: checks.map((check) => ({ ...check, warning: checkWarning(check, today) })),
    };
  },
});

export const createPurchase = mutation({
  args: {
    supplier: supplierKey,
    reference: v.optional(v.string()),
    items: v.array(
      v.object({
        productId: v.id("products"),
        quantity: v.number(),
        cost: v.number(),
        emptiesReturned: v.number(),
        emptyValue: v.number(),
      }),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const items = [];
    for (const item of args.items) {
      requireWholeNumber(item.quantity, ["Full cases", "punong kaha"]);
      requireWholeNumber(item.cost, ["Cost", "puhunan"]);
      requireWholeNumber(item.emptiesReturned, ["Empties returned", "empties na ibinalik"]);
      requireWholeNumber(item.emptyValue, ["Empty case value", "halaga ng bakanteng kaha"]);
      if (item.quantity === 0 && item.emptiesReturned === 0) continue;
      const product = await ctx.db.get("products", item.productId);
      if (!product) fail("Product not found.", "Hindi makita ang produkto.");
      if (item.emptiesReturned > 0 && !product.returnable) {
        fail("Only returnable products have empties.", "Ang mga produktong may ibinabalik na kaha lang ang may empties.");
      }
      items.push({ ...item, productId: product._id, name: product.name });
    }
    if (items.length === 0) fail("Enter the full cases or the empties.", "Ilagay ang punong kaha o ang empties.");
    const totals = computePurchase(items);
    const purchaseId = await ctx.db.insert("supplierPurchases", {
      supplier: args.supplier,
      date: manilaDate(),
      reference: cleanText(args.reference),
      items,
      ...totals,
      note: cleanText(args.note),
    });
    await logActivity(
      ctx,
      userId,
      "Supplier purchase",
      `${SUPPLIER_NAMES[args.supplier]}: ${totals.cases} full, ${totals.empties} empties, ${formatPeso(totals.total)}`,
    );
    return { purchaseId, cases: totals.cases, empties: totals.empties };
  },
});

// Records the purchase in today's stock once: full cases in, and the empties
// out of storage as given back to the supplier.
export const addPurchaseToStock = mutation({
  args: { purchaseId: v.id("supplierPurchases") },
  handler: async (ctx, { purchaseId }) => {
    const userId = await requireUser(ctx);
    const purchase = await ctx.db.get("supplierPurchases", purchaseId);
    if (!purchase) fail("Purchase not found.", "Hindi makita ang binili.");
    if (purchase.stockInId) fail("These cases are already in the stock.", "Nasa stock na ang mga kahang ito.");
    const stockInId = await recordStockIn(ctx, userId, {
      supplier: SUPPLIER_NAMES[purchase.supplier],
      reference: purchase.reference,
      items: purchase.items.map(({ productId, quantity, cost }) => ({ productId, quantity, cost })),
      emptiesReturned: purchase.items.map(({ productId, emptiesReturned }) => ({ productId, quantity: emptiesReturned })),
    });
    await ctx.db.patch("supplierPurchases", purchaseId, { stockInId });
  },
});

export const addCheck = mutation({
  args: {
    supplier: supplierKey,
    checkNo: v.string(),
    bank: v.optional(v.string()),
    amount: v.number(),
    checkDate: v.string(),
    dueDate: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const checkNo = cleanText(args.checkNo);
    if (!checkNo) fail("Enter the check number.", "Ilagay ang numero ng tseke.");
    requireWholeNumber(args.amount, ["Amount", "halaga"], { min: 1 });
    if (!isValidDate(args.checkDate) || !isValidDate(args.dueDate)) {
      fail("Enter the check date and the due date.", "Ilagay ang petsa ng tseke at ang due date.");
    }
    await ctx.db.insert("supplierChecks", {
      supplier: args.supplier,
      checkNo,
      bank: cleanText(args.bank),
      amount: args.amount,
      checkDate: args.checkDate,
      dueDate: args.dueDate,
      status: "pending",
      note: cleanText(args.note),
    });
    await logActivity(
      ctx,
      userId,
      "Added check",
      `${SUPPLIER_NAMES[args.supplier]}: #${checkNo}, ${formatPeso(args.amount)}, dated ${args.checkDate}, due ${args.dueDate}`,
    );
  },
});

export const setCheckStatus = mutation({
  args: { checkId: v.id("supplierChecks"), status: checkStatus },
  handler: async (ctx, { checkId, status }) => {
    const userId = await requireUser(ctx);
    const check = await ctx.db.get("supplierChecks", checkId);
    if (!check) fail("Check not found.", "Hindi makita ang tseke.");
    await ctx.db.patch("supplierChecks", checkId, { status });
    await logActivity(ctx, userId, "Check status", `#${check.checkNo}: ${check.status} → ${status}`);
  },
});

// Checks that haven't cleared and need attention, for the Home page.
export const checkWarnings = query({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    if (!(await currentUser(ctx))) return null;
    const pending = await ctx.db
      .query("supplierChecks")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    return pending
      .map((check) => ({ ...check, warning: checkWarning(check, today) }))
      .filter((check) => check.warning !== null)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  },
});

// What was sold of this supplier's products on a day, from that day's orders
// (cancelled orders left out): cases and amount per product, and the totals.
export const salesByDay = query({
  args: { supplier: supplierKey, date: v.string() },
  handler: async (ctx, { supplier, date }) => {
    if (!(await currentUser(ctx))) return null;
    if (!isValidDate(date)) fail("Choose a date.", "Pumili ng petsa.");
    const products = await ctx.db.query("products").collect();
    const ranks = groupRanks(await listGroups(ctx));
    const ofSupplier = new Map(products.filter((p) => supplierOf(p) === supplier).map((p) => [p._id, p]));
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_date", (q) => q.eq("date", date))
      .collect();
    const lines = new Map<Id<"products">, { productId: Id<"products">; name: string; category: Doc<"products">["category"]; groupId?: Id<"productGroups">; cases: number; amount: number }>();
    let orderCount = 0;
    for (const order of orders) {
      if (order.voided) continue;
      let counted = false;
      for (const item of order.items) {
        const product = ofSupplier.get(item.productId);
        if (!product || item.quantity === 0) continue;
        counted = true;
        const line = lines.get(product._id) ?? {
          productId: product._id,
          name: product.name,
          category: product.category,
          groupId: product.groupId,
          cases: 0,
          amount: 0,
        };
        line.cases += item.quantity;
        line.amount += lineAmount(item);
        lines.set(product._id, line);
      }
      if (counted) orderCount += 1;
    }
    const rows = [...lines.values()].sort(compareProducts(ranks));
    return {
      rows,
      orders: orderCount,
      cases: rows.reduce((sum, row) => sum + row.cases, 0),
      amount: rows.reduce((sum, row) => sum + row.amount, 0),
    };
  },
});
