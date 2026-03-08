import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Upserts the Clerk user into the Convex `users` table.
 *
 * Called on every authenticated page mount via the `useEnsureUser` hook.
 * Safe to call repeatedly — it is idempotent.
 * New users always start with role "user"; role can only be changed server-side.
 */
export const upsertUser = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (existing) {
      // Keep name in sync with Clerk in case the user updated it
      if (existing.name !== args.name) {
        await ctx.db.patch(existing._id, { name: args.name });
      }
      return existing._id;
    }

    // First time — create with default "user" role
    // Role is NEVER accepted from the client; only set here or via admin tooling
    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      name: args.name,
      role: "user",
    });
  },
});

/**
 * Returns the full Convex user record for the currently authenticated caller.
 * Used by pages to know the caller's `_id` (for ownership checks) and `role`.
 */
export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
  },
});
