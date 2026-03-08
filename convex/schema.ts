import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  /**
   * Users table — mirrors Clerk identities in Convex.
   * Created/updated via the `upsertUser` mutation on first authenticated visit.
   * The `role` field is the source of truth for RBAC and is never set by clients.
   */
  users: defineTable({
    clerkId: v.string(),          // Clerk user ID (subject from JWT)
    name: v.string(),             // Display name synced from Clerk
    role: v.union(
      v.literal("admin"),
      v.literal("user")
    ),
  }).index("by_clerk_id", ["clerkId"]),

  /**
   * Recommendations table — the core content of HypeShelf.
   * All write operations enforce RBAC server-side before touching this table.
   */
  recommendations: defineTable({
    title: v.string(),
    genre: v.string(),
    link: v.string(),             // Must be a valid http/https URL (validated in mutation)
    blurb: v.string(),
    userId: v.id("users"),        // Reference to the Convex user who created it
    createdAt: v.number(),        // Unix timestamp in ms
    staffPick: v.boolean(),       // Only admins can set this to true
  })
    .index("by_created_at", ["createdAt"])
    .index("by_genre", ["genre"])
    .index("by_user", ["userId"]),
});
