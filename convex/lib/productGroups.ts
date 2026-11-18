import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

// Shared by the server and the screens so orders, receipts and lists all
// follow the same order: by group (as set by the owner), then by name.
// Products without a group come last.

type Sortable = { name: string; groupId?: Id<"productGroups"> };

export function groupRanks(groups: Pick<Doc<"productGroups">, "_id" | "position">[]) {
  const sorted = [...groups].sort((a, b) => a.position - b.position);
  return new Map(sorted.map((group, index) => [group._id, index]));
}

export function compareProducts(ranks: Map<Id<"productGroups">, number>) {
  const rank = (p: Sortable) => (p.groupId !== undefined ? (ranks.get(p.groupId) ?? Infinity) : Infinity);
  return (a: Sortable, b: Sortable) => rank(a) - rank(b) || a.name.localeCompare(b.name);
}

export async function listGroups(ctx: QueryCtx) {
  return (await ctx.db.query("productGroups").collect()).sort((a, b) => a.position - b.position);
}
