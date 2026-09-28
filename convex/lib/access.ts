import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

// Queries return null instead of throwing when signed out, so a screen that is
// mid sign-out renders nothing instead of crashing.
export async function currentUser(ctx: QueryCtx): Promise<Id<"users"> | null> {
  return await getAuthUserId(ctx);
}

// Errors the owner sees, in both languages. The app shows the one in use.
export function fail(en: string, fil: string): never {
  throw new ConvexError({ en, fil });
}

export type Label = readonly [en: string, fil: string];

export async function requireUser(ctx: MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) fail("Please sign in again.", "Mag-sign in po ulit.");
  return userId;
}

export async function logActivity(
  ctx: MutationCtx,
  userId: Id<"users">,
  action: string,
  details: string,
) {
  await ctx.db.insert("auditLog", { userId, action, details });
}

export function requireWholeNumber(value: number, label: Label, { min = 0 } = {}) {
  if (!Number.isInteger(value) || value < min) {
    fail(
      `${label[0]} must be a whole number${min > 0 ? ` of at least ${min}` : ""}.`,
      `Ang ${label[1]} ay dapat buong numero${min > 0 ? ` na hindi bababa sa ${min}` : ""}.`,
    );
  }
}

export function cleanText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
