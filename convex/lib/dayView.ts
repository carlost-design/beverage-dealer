import type { QueryCtx } from "../_generated/server";
import {
  carriedStock,
  expectedClosing,
  getDayDoc,
  hasLaterDay,
  latestDayBefore,
} from "./stock";

// Read-side view of a business day. Days that haven't started yet show the
// stock that would carry over.
async function stockRows(ctx: QueryCtx, date: string, dayExists: boolean) {
  const products = await ctx.db.query("products").collect();
  const stored = dayExists
    ? await ctx.db
        .query("dailyStock")
        .withIndex("by_date_product", (q) => q.eq("date", date))
        .collect()
    : [];
  const byProduct = new Map(stored.map((row) => [row.productId, row]));
  const rows = [];
  for (const product of products) {
    const row = byProduct.get(product._id);
    if (!row && !product.active) continue;
    const counts = row ?? {
      starting: await carriedStock(ctx, product._id, date),
      stockIn: 0,
      sold: 0,
      returned: 0,
      damaged: 0,
      adjusted: 0,
      counted: undefined,
    };
    const expected = expectedClosing(counts);
    rows.push({
      productId: product._id,
      name: product.name,
      category: product.category,
      returnable: product.returnable,
      active: product.active,
      lowStockLevel: product.lowStockLevel,
      emptiesOnHand: product.emptiesOnHand,
      starting: counts.starting,
      stockIn: counts.stockIn,
      sold: counts.sold,
      returned: counts.returned,
      damaged: counts.damaged,
      adjusted: counts.adjusted,
      expected,
      counted: counts.counted,
      variance: counts.counted === undefined ? undefined : counts.counted - expected,
    });
  }
  return rows.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

export type StockRow = Awaited<ReturnType<typeof stockRows>>[number];

export async function dayView(ctx: QueryCtx, date: string) {
  const day = await getDayDoc(ctx, date);
  const previous = await latestDayBefore(ctx, date);
  return {
    date,
    status: day?.status ?? ("not_started" as const),
    counted: day?.counted ?? false,
    closedAt: day?.closedAt,
    isLatest: !(await hasLaterDay(ctx, date)),
    previousOpen: previous?.status === "open" ? previous.date : null,
    rows: await stockRows(ctx, date, day !== null),
  };
}

