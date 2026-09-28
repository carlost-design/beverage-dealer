import { paginationOptsValidator } from "convex/server";
import { query } from "./_generated/server";
import { currentUser } from "./lib/access";

// Public on purpose: the sign-in screen uses it to decide between "create the
// owner account" and "sign in". It only says whether an account exists.
export const hasOwner = query({
  args: {},
  handler: async (ctx) => (await ctx.db.query("users").first()) !== null,
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await currentUser(ctx);
    if (!userId) return null;
    const user = await ctx.db.get("users", userId);
    return { email: user?.email };
  },
});

export const activityLog = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    if (!(await currentUser(ctx))) return { page: [], isDone: true, continueCursor: "" };
    return await ctx.db.query("auditLog").order("desc").paginate(paginationOpts);
  },
});
