import { v, type Infer } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { cleanText, currentUser, fail, logActivity, requireUser, requireWholeNumber } from "./lib/access";
import { manilaDate } from "./lib/dates";
import { formatPeso } from "./lib/money";
import { compareProducts, groupRanks, listGroups } from "./lib/productGroups";
import { moveStock, openDay, recordEmpties } from "./lib/stock";
import { productCategory, productSupplier } from "./schema";

const productFields = v.object({
  name: v.string(),
  category: productCategory,
  price: v.number(),
  cost: v.number(),
  returnable: v.boolean(),
  lowStockLevel: v.number(),
  supplier: v.optional(productSupplier),
  emptyValue: v.optional(v.number()),
  groupId: v.optional(v.id("productGroups")),
});

function cleanProduct(input: Infer<typeof productFields>) {
  const name = cleanText(input.name);
  if (!name) fail("Enter the product name.", "Ilagay ang pangalan ng produkto.");
  requireWholeNumber(input.price, ["Price", "presyo"]);
  requireWholeNumber(input.cost, ["Cost", "puhunan"]);
  requireWholeNumber(input.lowStockLevel, ["Low stock level", "babala sa paubos na stock"]);
  if (input.emptyValue !== undefined) requireWholeNumber(input.emptyValue, ["Empty case value", "halaga ng bakanteng kaha"]);
  return { ...input, name };
}

async function requireGroup(ctx: QueryCtx, groupId: Id<"productGroups"> | undefined) {
  if (groupId && !(await ctx.db.get("productGroups", groupId))) {
    fail("That group no longer exists. Choose another.", "Wala na ang group na iyon. Pumili ng iba.");
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    if (!(await currentUser(ctx))) return null;
    const products = await ctx.db.query("products").collect();
    const groups = await listGroups(ctx);
    // With no groups yet, products follow their category, as before.
    const byGroup = groups.length
      ? compareProducts(groupRanks(groups))
      : (a: (typeof products)[number], b: (typeof products)[number]) =>
          a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
    return products.sort((a, b) => Number(b.active) - Number(a.active) || byGroup(a, b));
  },
});

export const create = mutation({
  args: { product: productFields, openingStock: v.number(), openingEmpties: v.number() },
  handler: async (ctx, { product, openingStock, openingEmpties }) => {
    const userId = await requireUser(ctx);
    const fields = cleanProduct(product);
    await requireGroup(ctx, fields.groupId);
    requireWholeNumber(openingStock, ["Current stock", "kasalukuyang stock"]);
    requireWholeNumber(openingEmpties, ["Empties on hand", "empties sa bodega"]);
    const duplicate = (await ctx.db.query("products").collect()).find(
      (p) => p.name.toLowerCase() === fields.name.toLowerCase(),
    );
    if (duplicate) {
      fail(`There is already a product named ${duplicate.name}.`, `Mayroon nang produktong ${duplicate.name}.`);
    }

    const productId = await ctx.db.insert("products", { ...fields, emptiesOnHand: 0, active: true });
    const date = manilaDate();
    if (openingStock > 0) {
      await openDay(ctx, date);
      await moveStock(ctx, {
        date,
        productId,
        field: "adjusted",
        quantity: openingStock,
        type: "adjustment",
        note: "Opening stock",
      });
    }
    if (fields.returnable && openingEmpties > 0) {
      await recordEmpties(ctx, {
        date,
        productId,
        type: "warehouse_adjustment",
        quantity: openingEmpties,
        note: "Opening empties",
      });
    }
    await logActivity(
      ctx,
      userId,
      "Added product",
      `${fields.name} at ${formatPeso(fields.price)} per case${openingStock ? `, ${openingStock} cases in stock` : ""}`,
    );
    return productId;
  },
});

export const update = mutation({
  args: { productId: v.id("products"), product: productFields },
  handler: async (ctx, { productId, product }) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db.get("products", productId);
    if (!existing) fail("Product not found.", "Hindi makita ang produkto.");
    const fields = cleanProduct(product);
    await requireGroup(ctx, fields.groupId);
    // Sent without a group: clear it.
    await ctx.db.patch("products", productId, { ...fields, groupId: fields.groupId });

    const changes = [];
    if (existing.price !== fields.price) {
      changes.push(`price ${formatPeso(existing.price)} → ${formatPeso(fields.price)}`);
    }
    if (existing.cost !== fields.cost) {
      changes.push(`cost ${formatPeso(existing.cost)} → ${formatPeso(fields.cost)}`);
    }
    await logActivity(
      ctx,
      userId,
      "Updated product",
      `${fields.name}${changes.length ? `: ${changes.join(", ")}` : ""}`,
    );
  },
});

export const setActive = mutation({
  args: { productId: v.id("products"), active: v.boolean() },
  handler: async (ctx, { productId, active }) => {
    const userId = await requireUser(ctx);
    const product = await ctx.db.get("products", productId);
    if (!product) fail("Product not found.", "Hindi makita ang produkto.");
    await ctx.db.patch("products", productId, { active });
    await logActivity(ctx, userId, active ? "Restored product" : "Archived product", product.name);
  },
});
