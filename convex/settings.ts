import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { cleanText, currentUser, fail, logActivity, requireUser, requireWholeNumber } from "./lib/access";
import { formatPeso } from "./lib/money";

type Settings = Omit<Doc<"settings">, "_id" | "_creationTime">;

const DEFAULT_SETTINGS: Settings = {
  businessName: "My Softdrinks & Beer Store",
  receiptFooter: "Salamat po!\nThis is not an official receipt.",
  paperWidth: "58mm",
  receiptCopies: 1,
};

export const get = query({
  args: {},
  handler: async (ctx) => {
    if (!(await currentUser(ctx))) return null;
    const saved = await ctx.db.query("settings").first();
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      hasBusinessName: saved !== null && saved.businessName !== DEFAULT_SETTINGS.businessName,
    };
  },
});

export const update = mutation({
  args: {
    businessName: v.string(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    receiptFooter: v.optional(v.string()),
    paperWidth: v.union(v.literal("58mm"), v.literal("80mm")),
    receiptCopies: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const businessName = cleanText(args.businessName);
    if (!businessName) fail("Enter the business name.", "Ilagay ang pangalan ng negosyo.");
    if (args.receiptCopies !== 1 && args.receiptCopies !== 2) {
      fail("Print 1 or 2 copies.", "1 o 2 kopya lang ang puwede.");
    }
    const fields = {
      businessName,
      address: cleanText(args.address),
      phone: cleanText(args.phone),
      receiptFooter: cleanText(args.receiptFooter),
      paperWidth: args.paperWidth,
      receiptCopies: args.receiptCopies,
    };
    const saved = await ctx.db.query("settings").first();
    if (saved) await ctx.db.patch("settings", saved._id, fields);
    else await ctx.db.insert("settings", fields);
    await logActivity(ctx, userId, "Updated settings", businessName);
  },
});

// The deposit for each case a client keeps, used on new orders.
export const setDepositPrice = mutation({
  args: { depositPerCase: v.number() },
  handler: async (ctx, { depositPerCase }) => {
    const userId = await requireUser(ctx);
    requireWholeNumber(depositPerCase, ["Deposit", "deposit"]);
    const saved = await ctx.db.query("settings").first();
    const value = depositPerCase > 0 ? depositPerCase : undefined;
    if (saved) await ctx.db.patch("settings", saved._id, { depositPerCase: value });
    else await ctx.db.insert("settings", { ...DEFAULT_SETTINGS, depositPerCase: value });
    await logActivity(ctx, userId, "Changed deposit price", `${formatPeso(depositPerCase)} per case`);
  },
});

// Saved on the account so every device the owner uses follows the same language.
export const setLanguage = mutation({
  args: { language: v.union(v.literal("en"), v.literal("fil")) },
  handler: async (ctx, { language }) => {
    await requireUser(ctx);
    const saved = await ctx.db.query("settings").first();
    if (saved) await ctx.db.patch("settings", saved._id, { language });
    else await ctx.db.insert("settings", { ...DEFAULT_SETTINGS, language });
  },
});
