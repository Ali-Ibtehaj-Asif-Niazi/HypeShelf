# HypeShelf — Security Model

This document covers the threat model, RBAC implementation, and security decisions made in HypeShelf.

---

## Threat Model

HypeShelf is a user-generated content platform. The primary concerns are:

| Threat Category | Specific Risk |
|---|---|
| **Authentication bypass** | Accessing protected routes or calling mutations without being signed in |
| **Privilege escalation** | A `user` granting themselves `admin` capabilities |
| **Unauthorised deletion** | A user deleting another user's recommendation |
| **Input abuse** | Injecting malicious URLs, oversized payloads, or script content |
| **Secret exposure** | API keys leaking into the client bundle |
| **Cross-site issues** | Malicious links opening phishing pages in the same context |

---

## Defence Layers

HypeShelf uses **three independent layers** of security. Each layer is complete on its own; they reinforce each other in depth.

```
Layer 1: HTTP middleware (Clerk)
  → Redirects unauthenticated users before any React code runs

Layer 2: Convex auth check (JWT verification)
  → Every mutation verifies the Clerk JWT before doing anything

Layer 3: RBAC check (DB role lookup)
  → Every sensitive mutation reads the role from Convex DB
    and enforces permissions based on it
```

An attacker would need to defeat all three layers simultaneously.

---

## Layer 1 — Route Protection (Clerk Middleware)

```ts
// middleware.ts
const isProtectedRoute = createRouteMatcher(["/recs(.*)", "/add(.*)"]);

clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});
```

`auth.protect()` runs on the **Next.js server edge** before any component renders. It checks the Clerk session cookie and redirects to the sign-in page if the user is not authenticated.

**What this prevents**: Unauthenticated users landing on protected pages.

**What this does NOT protect**: Direct Convex mutation calls. A developer-tools user could call a Convex mutation directly (bypassing the browser UI). This is why Layer 2 is essential.

---

## Layer 2 — Identity Verification (Convex JWT)

Every mutation begins with:

```ts
const identity = await ctx.auth.getUserIdentity();
if (!identity) throw new Error("Not authenticated");
```

`ctx.auth.getUserIdentity()` extracts and **cryptographically verifies** the Clerk JWT. Convex fetches Clerk's public JWKS endpoint (configured in `convex/auth.config.ts`) and validates:

- The JWT signature (RS256)
- The `aud` (audience) claim must equal `"convex"`
- The `iss` (issuer) claim must match `CLERK_JWT_ISSUER_DOMAIN`
- The token has not expired

If any check fails, `getUserIdentity()` returns `null` and the mutation throws before touching the database.

**What this prevents**: Forged requests, expired sessions, cross-tenant token reuse.

---

## Layer 3 — RBAC (Role-Based Access Control)

### Role Storage

Roles are stored **exclusively** in the Convex `users` table:

```ts
// convex/schema.ts
users: defineTable({
  clerkId: v.string(),
  name: v.string(),
  role: v.union(v.literal("admin"), v.literal("user")),
})
```

**The client never sends the role as a mutation argument.** The server reads it directly from the database after verifying the identity.

### Role Lookup Pattern

All RBAC-sensitive mutations follow this pattern:

```ts
// 1. Verify JWT — get Clerk identity
const identity = await ctx.auth.getUserIdentity();
if (!identity) throw new Error("Not authenticated");

// 2. Look up Convex user by clerkId — get role from DB
const user = await ctx.db
  .query("users")
  .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
  .unique();
if (!user) throw new Error("User record not found");

// 3. Enforce permission
if (user.role !== "admin") throw new Error("Unauthorized");
```

The `identity.subject` value comes from the verified JWT — it cannot be forged.

### Permission Matrix

| Mutation | Check |
|---|---|
| `createRecommendation` | `identity` must exist; user record must exist |
| `deleteRecommendation` | `rec.userId === user._id` (owner) OR `user.role === "admin"` |
| `markStaffPick` | `user.role === "admin"` — hard gate, throws immediately otherwise |

### Why Not Clerk Metadata?

Clerk supports `publicMetadata` on user objects, which can store custom fields like roles. We chose **not** to use this because:

1. `publicMetadata` is readable in the browser — a client could observe its own "role" and craft Convex calls assuming admin privileges
2. Convex mutations receive the JWT, not the full Clerk user object. Adding a role claim to the JWT would be custom work and still requires server-side verification
3. The Convex `users` table keeps roles completely server-side, never embedded in any client-readable token

---

## Input Validation

Input validation is applied at **two levels**: client-side for UX, and server-side as the authoritative check.

### Server-side (Convex — authoritative)

```ts
// convex/recommendations.ts — createRecommendation mutation

const title = args.title.trim();
const genre = args.genre.trim();
const blurb = args.blurb.trim();
const link  = args.link.trim();

if (!title)              throw new Error("Title is required");
if (!genre)              throw new Error("Genre is required");
if (!blurb)              throw new Error("Blurb is required");
if (title.length > 120)  throw new Error("Title must be under 120 characters");
if (genre.length > 60)   throw new Error("Genre must be under 60 characters");
if (blurb.length > 300)  throw new Error("Blurb must be under 300 characters");

// URL validation — http/https only
try {
  const url = new URL(link);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Link must use http or https");
  }
} catch {
  throw new Error("Invalid URL");
}
```

### URL Safety

All external links are rendered with:

```tsx
<a href={rec.link} target="_blank" rel="noopener noreferrer">
```

- `target="_blank"` opens in a new tab
- `rel="noopener"` prevents the opened page from accessing `window.opener` (tab-napping prevention)
- `rel="noreferrer"` suppresses the `Referer` header

`javascript:` and `data:` URLs are blocked by the server-side `new URL()` + protocol check.

---

## XSS Prevention

HypeShelf has **no custom HTML rendering**. All user-supplied content (title, genre, blurb, name) is rendered as text nodes via React:

```tsx
<h3>{rec.title}</h3>
<p>{rec.blurb}</p>
```

React escapes all string content by default. There is no `dangerouslySetInnerHTML` usage anywhere in the codebase.

---

## Secret Management

| Secret | Where it lives | Exposed to client? |
|---|---|---|
| `CLERK_SECRET_KEY` | Server-only `.env.local` | No |
| `CLERK_JWT_ISSUER_DOMAIN` | Server `.env.local` + Convex dashboard | No |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `.env.local` (NEXT_PUBLIC) | Yes — by design |
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` (NEXT_PUBLIC) | Yes — by design |

The `CLERK_SECRET_KEY` is used by the Next.js server (Clerk middleware) and never bundled. `NEXT_PUBLIC_*` variables are safe to expose — they are public-facing identifiers with no privilege.

**`.env.local` is gitignored.** Only `.env.local.example` (with placeholder values) is committed.

---

## `staffPick` Integrity

The `staffPick` field can only be changed via `markStaffPick`, which has an admin-only gate:

```ts
if (user.role !== "admin") {
  throw new Error("Unauthorized: only admins can manage Staff Picks");
}
```

When a recommendation is **created**, `staffPick` is always hardcoded to `false` server-side:

```ts
await ctx.db.insert("recommendations", {
  ...fields,
  staffPick: false,  // Client cannot set this — not in mutation args
});
```

The `createRecommendation` mutation does not accept `staffPick` as an argument. It is not possible for a client to create a recommendation with `staffPick: true`.

---

## Role Promotion

Currently, role promotion (`"user"` → `"admin"`) is done manually via the Convex Dashboard. This is intentional for the initial version:

- There are no admin-accessible endpoints that could be exploited for self-promotion
- Role changes require direct database access (which requires Convex account credentials)

A future improvement would be a protected `/admin` page that allows existing admins to promote users, with the mutation containing its own admin-only gate.

---

## Summary of Security Properties

| Property | Implemented | Mechanism |
|---|---|---|
| Authentication required for writes | ✅ | `ctx.auth.getUserIdentity()` in every mutation |
| Role never trusted from client | ✅ | Role read from Convex DB, not from args |
| Ownership enforced server-side | ✅ | `rec.userId === user._id` comparison |
| Admin-only operations gated | ✅ | `user.role !== "admin"` → throw |
| URL injection prevented | ✅ | Protocol validation server-side |
| XSS via user content | ✅ | React default escaping, no raw HTML |
| Malicious link tab-napping | ✅ | `rel="noopener noreferrer"` |
| Secret key not exposed | ✅ | Only `NEXT_PUBLIC_*` vars in bundle |
| Staff Pick forgery | ✅ | Not in create args; mutation-only via admin gate |
| Route protection (HTTP level) | ✅ | Clerk middleware on `/recs`, `/add` |
