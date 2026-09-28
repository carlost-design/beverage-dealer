import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { fail } from "./lib/access";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
  callbacks: {
    // Only the owner can have an account: the first sign-up creates it, and
    // every sign-up after that is refused.
    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId) return args.existingUserId;
      const owner = await ctx.db.query("users").first();
      if (owner) {
        fail("An owner account already exists. Please sign in.", "May owner account na. Mag-sign in na lang po.");
      }
      const email = typeof args.profile.email === "string" ? args.profile.email : undefined;
      return await ctx.db.insert("users", { email });
    },
  },
});
