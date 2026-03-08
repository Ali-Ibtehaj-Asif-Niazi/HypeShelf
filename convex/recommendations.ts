import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// ─── Internal helper ──────────────────────────────────────────────────────────

/**
 * Resolves the Convex user record for the currently authenticated identity.
 * Returns null if unauthenticated or if the user has not been synced yet.
 */
async function resolveCurrentUser(ctx: {
  auth: { getUserIdentity(): Promise<{ subject: string } | null> };
  db: { query(table: "users"): any };
}) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
    .unique() as Promise<{
    _id: Id<"users">;
    clerkId: string;
    name: string;
    role: "admin" | "user";
  } | null>;
}

/**
 * Joins a recommendation row with its author's display name.
 * Convex has no SQL joins; we fetch the related row manually.
 */
async function withUserName(
  ctx: { db: { get(id: Id<"users">): Promise<{ name: string } | null> } },
  rec: { userId: Id<"users"> } & Record<string, unknown>
) {
  const user = await ctx.db.get(rec.userId as Id<"users">);
  return { ...rec, userName: user?.name ?? "Unknown" };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * PUBLIC — no auth required.
 * Returns the 20 most recent recommendations for the public landing page.
 */
export const getLatestRecommendations = query({
  args: {},
  handler: async (ctx) => {
    const recs = await ctx.db
      .query("recommendations")
      .withIndex("by_created_at")
      .order("desc")
      .take(20);

    return Promise.all(recs.map((rec) => withUserName(ctx as any, rec)));
  },
});

/**
 * AUTHENTICATED — returns all recommendations for the /recs page.
 * Throws if the caller is not authenticated.
 */
export const getAllRecommendations = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const recs = await ctx.db
      .query("recommendations")
      .withIndex("by_created_at")
      .order("desc")
      .collect();

    return Promise.all(recs.map((rec) => withUserName(ctx as any, rec)));
  },
});

/**
 * AUTHENTICATED — returns recommendations for a specific genre.
 * Used by the FilterBar server-side path.
 */
export const getRecommendationsByGenre = query({
  args: { genre: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const recs = await ctx.db
      .query("recommendations")
      .withIndex("by_genre", (q) => q.eq("genre", args.genre))
      .order("desc")
      .collect();

    return Promise.all(recs.map((rec) => withUserName(ctx as any, rec)));
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * AUTHENTICATED — any signed-in user may add a recommendation.
 *
 * Security:
 *  - Identity comes from the Clerk JWT forwarded by Convex; never from args
 *  - URL is validated server-side (http/https only)
 *  - All text fields are trimmed and checked for emptiness
 *  - `staffPick` defaults to false; clients cannot set it
 */
export const createRecommendation = mutation({
  args: {
    title: v.string(),
    genre: v.string(),
    link: v.string(),
    blurb: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await resolveCurrentUser(ctx as any);
    if (!user) throw new Error("User record not found. Please refresh and try again.");

    // Server-side validation
    const title = args.title.trim();
    const genre = args.genre.trim();
    const blurb = args.blurb.trim();
    const link = args.link.trim();

    if (!title) throw new Error("Title is required");
    if (!genre) throw new Error("Genre is required");
    if (!blurb) throw new Error("Blurb is required");
    if (title.length > 120) throw new Error("Title must be under 120 characters");
    if (genre.length > 60) throw new Error("Genre must be under 60 characters");
    if (blurb.length > 300) throw new Error("Blurb must be under 300 characters");

    // Validate URL — only http/https allowed
    try {
      const url = new URL(link);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Link must use http or https");
      }
    } catch {
      throw new Error("Invalid URL — must start with https:// or http://");
    }

    return await ctx.db.insert("recommendations", {
      title,
      genre,
      link,
      blurb,
      userId: user._id,
      createdAt: Date.now(),
      staffPick: false, // Only admins can elevate via markStaffPick
    });
  },
});

/**
 * AUTHENTICATED — deletes a recommendation.
 *
 * RBAC:
 *  - `user` role: may only delete their own recommendations
 *  - `admin` role: may delete any recommendation
 *
 * The check is done against the Convex user record (role field), not client state.
 */
export const deleteRecommendation = mutation({
  args: { id: v.id("recommendations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await resolveCurrentUser(ctx as any);
    if (!user) throw new Error("User record not found");

    const rec = await ctx.db.get(args.id);
    if (!rec) throw new Error("Recommendation not found");

    // RBAC enforcement — compare Convex user IDs, not Clerk IDs
    const isOwner = rec.userId === user._id;
    const isAdmin = user.role === "admin";

    if (!isOwner && !isAdmin) {
      throw new Error("Unauthorized: you can only delete your own recommendations");
    }

    await ctx.db.delete(args.id);
  },
});

/**
 * ADMIN ONLY — toggles the Staff Pick badge on a recommendation.
 *
 * RBAC: throws immediately if the caller's role is not "admin".
 * Role is read from the Convex DB, never from args or client state.
 */
export const markStaffPick = mutation({
  args: {
    id: v.id("recommendations"),
    staffPick: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await resolveCurrentUser(ctx as any);
    if (!user) throw new Error("User record not found");

    // Hard gate: only admins proceed
    if (user.role !== "admin") {
      throw new Error("Unauthorized: only admins can manage Staff Picks");
    }

    const rec = await ctx.db.get(args.id);
    if (!rec) throw new Error("Recommendation not found");

    await ctx.db.patch(args.id, { staffPick: args.staffPick });
  },
});
