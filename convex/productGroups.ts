import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { cleanText, currentUser, fail, logActivity, requireUser } from "./lib/access";
import { listGroups } from "./lib/productGroups";

export const list = query({
  args: {},
  handler: async (ctx) => {
    if (!(await currentUser(ctx))) return null;
    return await listGroups(ctx);
  },
});

async function requireUniqueName(ctx: Parameters<typeof listGroups>[0], name: string | undefined, except?: string) {
  if (!name) fail("Enter the group name.", "Ilagay ang pangalan ng group.");
  const groups = await listGroups(ctx);
  if (groups.some((g) => g._id !== except && g.name.toLowerCase() === name.toLowerCase())) {
    fail(`There is already a group named ${name}.`, `Mayroon nang group na ${name}.`);
  }
  return { name, groups };
}

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const { name, groups } = await requireUniqueName(ctx, cleanText(args.name));
    const position = groups.length ? groups[groups.length - 1].position + 1 : 0;
    const groupId = await ctx.db.insert("productGroups", { name, position });
    await logActivity(ctx, userId, "Added product group", name);
    return groupId;
  },
});

export const rename = mutation({
  args: { groupId: v.id("productGroups"), name: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const group = await ctx.db.get("productGroups", args.groupId);
    if (!group) fail("Group not found.", "Hindi makita ang group.");
    const { name } = await requireUniqueName(ctx, cleanText(args.name), group._id);
    await ctx.db.patch("productGroups", group._id, { name });
    await logActivity(ctx, userId, "Renamed product group", `${group.name} → ${name}`);
  },
});

// Swaps a group with the one above or below it.
export const move = mutation({
  args: { groupId: v.id("productGroups"), direction: v.union(v.literal("up"), v.literal("down")) },
  handler: async (ctx, { groupId, direction }) => {
    await requireUser(ctx);
    const groups = await listGroups(ctx);
    const index = groups.findIndex((g) => g._id === groupId);
    if (index === -1) fail("Group not found.", "Hindi makita ang group.");
    const other = groups[direction === "up" ? index - 1 : index + 1];
    if (!other) return;
    // Renumber so every position is distinct, then swap the two.
    for (const [i, g] of groups.entries()) {
      if (g.position !== i) await ctx.db.patch("productGroups", g._id, { position: i });
    }
    const otherIndex = direction === "up" ? index - 1 : index + 1;
    await ctx.db.patch("productGroups", groupId, { position: otherIndex });
    await ctx.db.patch("productGroups", other._id, { position: index });
  },
});

// Products in the group stay; they just have no group anymore.
export const remove = mutation({
  args: { groupId: v.id("productGroups") },
  handler: async (ctx, { groupId }) => {
    const userId = await requireUser(ctx);
    const group = await ctx.db.get("productGroups", groupId);
    if (!group) fail("Group not found.", "Hindi makita ang group.");
    for (const product of await ctx.db.query("products").collect()) {
      if (product.groupId === groupId) await ctx.db.patch("products", product._id, { groupId: undefined });
    }
    await ctx.db.delete("productGroups", groupId);
    await logActivity(ctx, userId, "Removed product group", group.name);
  },
});
