# HypeShelf — Architecture

This document describes the technical architecture, data flow, and key design decisions behind HypeShelf.

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
│                                                                 │
│  Next.js 15 App Router (React 19)                               │
│                                                                 │
│  ┌─────────────────┐     ┌──────────────────────────────────┐  │
│  │  Clerk Provider │     │     Convex React Client           │  │
│  │  (auth context) │────▶│  (real-time WebSocket sub)       │  │
│  └─────────────────┘     └──────────────────────────────────┘  │
└────────────────────────────────────┬────────────────────────────┘
                                     │ HTTPS + WebSocket
              ┌──────────────────────┼──────────────────────┐
              │                      │                       │
              ▼                      ▼                       ▼
     ┌──────────────┐     ┌──────────────────┐    ┌──────────────┐
     │ Clerk Cloud  │     │  Convex Cloud    │    │ Clerk JWKS   │
     │  (identity)  │     │  (DB + logic)    │◀───│  (JWT verify)│
     └──────────────┘     └──────────────────┘    └──────────────┘
```

**The two backend services never communicate directly with each other.** Instead:
1. The browser authenticates with Clerk and receives a signed JWT
2. `ConvexProviderWithClerk` forwards that JWT to Convex on every request
3. Convex verifies the JWT signature by fetching Clerk's JWKS endpoint
4. On verification, `ctx.auth.getUserIdentity()` is populated inside Convex functions

---

## Authentication Flow

```
User clicks "Sign in"
        │
        ▼
Clerk modal opens (hosted by Clerk)
        │
        ▼
User authenticates (email/password, OAuth, etc.)
        │
        ▼
Clerk issues a signed JWT (RS256)
  subject = Clerk user ID
  audience = "convex"
        │
        ▼
ConvexProviderWithClerk intercepts Clerk's auth state
        │
        ▼
Convex client sends JWT with every query/mutation
        │
        ▼
Convex backend verifies JWT against CLERK_JWT_ISSUER_DOMAIN
        │
        ├── Invalid → request rejected
        └── Valid   → ctx.auth.getUserIdentity() returns { subject, ... }
                              │
                              ▼
                   Look up users table by clerkId
                              │
                              ▼
                   Enforce RBAC from DB role field
```

---

## User Sync Flow

Clerk and Convex maintain **separate user records**:

- **Clerk** stores: identity, email, OAuth tokens, session
- **Convex** stores: `clerkId` (FK), `name`, `role`

These are linked by the `clerkId` field (Clerk's user subject from the JWT).

```
User signs in via Clerk
        │
        ▼
Authenticated page mounts
        │
        ▼
useEnsureUser() hook fires
        │
        ▼
calls upsertUser({ name }) mutation
        │
        ├── User exists in Convex? → update name if changed
        └── User not found?        → INSERT with role: "user"
```

This is idempotent — safe to call on every mount. The `role` field is **never** passed from the client; it is always set server-side.

---

## Data Flow: Reading Recommendations

### Public page (`/`)

```
Component mounts
        │
        ▼
useQuery(api.recommendations.getLatestRecommendations)
        │  (no auth required)
        ▼
Convex query runs server-side:
  1. db.query("recommendations").withIndex("by_created_at").order("desc").take(20)
  2. For each rec: db.get(rec.userId) → fetch author name
  3. Return enriched array
        │
        ▼
Convex WebSocket pushes result to client
        │
        ▼
React renders card grid
        │
        ▼
Any future insert/update/delete → Convex re-runs query → pushes diff → React re-renders
```

### Authenticated page (`/recs`)

```
Component mounts
        │
        ▼
useConvexAuth() → wait for isAuthenticated = true
  (prevents query from firing before JWT handshake completes)
        │
        ▼
useQuery(api.recommendations.getAllRecommendations, {})
        │
        ▼
Convex verifies JWT, runs query, returns all recs with userNames
        │
        ▼
useQuery(api.users.getMe, {}) → returns { _id, role }
        │
        ▼
React renders grid, passing isAdmin and isOwner props to each card
```

---

## Data Flow: Writing (Mutations)

### Creating a recommendation

```
User submits form
        │
        ▼
Client-side validation (UX only — title, genre, blurb, URL format)
        │
        ▼
useMutation(api.recommendations.createRecommendation)({ title, genre, link, blurb })
        │
        ▼
Convex mutation runs:
  1. ctx.auth.getUserIdentity() — verify JWT
  2. Look up users table by clerkId
  3. Server-side validation (char limits, URL protocol)
  4. db.insert("recommendations", { ...fields, userId: user._id, staffPick: false })
        │
        ▼
Convex invalidates all subscriptions to recommendations table
        │
        ▼
All connected clients receive updated data in real-time
```

### RBAC-protected mutation (delete)

```
User clicks Delete
        │
        ▼
useMutation(api.recommendations.deleteRecommendation)({ id })
        │
        ▼
Convex mutation:
  1. ctx.auth.getUserIdentity()       ← from Clerk JWT (unforgeable)
  2. users.by_clerk_id lookup         ← get role from DB
  3. db.get(id)                       ← get the target recommendation
  4. Check: rec.userId === user._id   ← ownership
         OR user.role === "admin"     ← admin override
  5. Pass → db.delete(id)
     Fail → throw "Unauthorized"
```

The client-side `isOwner` / `isAdmin` flags only control **whether the delete button is rendered**. The actual permission gate is on step 4, server-side.

---

## Provider Nesting

```tsx
// src/app/layout.tsx
<ClerkProvider>               ← Must be outermost — Convex uses useAuth() from Clerk
  <html>
    <body>
      <ConvexClientProvider>  ← Uses useAuth() internally to attach Clerk JWT
        {children}
      </ConvexClientProvider>
    </body>
  </html>
</ClerkProvider>
```

`ConvexClientProvider` wraps children with `ConvexProviderWithClerk`, which subscribes to Clerk's auth state and automatically refreshes the JWT before it expires.

---

## Middleware (Route Protection)

```ts
// middleware.ts
const isProtectedRoute = createRouteMatcher(["/recs(.*)", "/add(.*)"]);

clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});
```

`auth.protect()` redirects unauthenticated users to Clerk's sign-in page. This is the **first** layer of protection — a fast HTTP redirect before any React rendering occurs.

The Convex mutations are the **second** layer — they enforce auth server-side regardless of how the request reaches them.

---

## Real-Time Architecture

Convex uses **reactive queries**. Every `useQuery` call establishes a WebSocket subscription:

```
Client subscribes to query Q with args A
        │
        ▼
Convex executes Q(A) → returns result R
        │
        ▼
Convex tracks which DB tables/rows Q read
        │
        ▼
Any future write to those tables triggers:
  Convex re-executes Q(A) → if result changed → pushes diff to client
        │
        ▼
React component re-renders with new data
```

This means: when any user adds a recommendation, **every client viewing `/recs` or `/` updates automatically** — no polling, no manual refresh.

---

## TypeScript End-to-End Safety

```
convex/schema.ts          →  defines table shapes
        │
npx convex dev            →  generates convex/_generated/dataModel.d.ts
        │                                          convex/_generated/api.d.ts
        ▼
src/ code imports from convex/_generated/
  - Doc<"recommendations">  →  typed recommendation row
  - Id<"recommendations">   →  branded string type for IDs
  - api.recommendations.*   →  typed function references
```

If you rename a field in `schema.ts`, TypeScript will report errors in every component that accesses that field — before you run the app.

---

## Deployment Architecture

### Development

```
Terminal 1: npx convex dev    → watches convex/ → hot-pushes to Convex Cloud dev env
Terminal 2: npm run dev       → Next.js dev server on :3000
```

### Production

```
npx convex deploy             → pushes schema + functions to Convex Cloud prod env
Vercel deploy                 → builds Next.js → sets NEXT_PUBLIC_CONVEX_URL to prod URL
```

Both services are serverless — no infrastructure to manage.

---

## Component Architecture

```
layout.tsx
└── ClerkProvider
    └── ConvexClientProvider
        ├── page.tsx (/)
        │   ├── Header
        │   └── RecommendationCard[]
        │
        ├── recs/page.tsx
        │   ├── Header
        │   ├── FilterBar
        │   └── RecommendationCard[]
        │           (with onDelete, onToggleStaffPick props)
        │
        └── add/page.tsx
            ├── Header
            └── AddRecommendationForm
```

All pages are Client Components (`"use client"`) because they use Convex's `useQuery`/`useMutation` hooks, which require React context. The `layout.tsx` is a Server Component — the client boundary is established by the providers inside it.

---

## Key Files Quick Reference

| File | Purpose |
|---|---|
| `convex/schema.ts` | Single source of truth for all DB table shapes |
| `convex/auth.config.ts` | Tells Convex which JWT issuer to trust |
| `convex/users.ts` | `upsertUser` (create/sync), `getMe` (role lookup) |
| `convex/recommendations.ts` | All queries + mutations with inline RBAC enforcement |
| `src/lib/ConvexClientProvider.tsx` | Singleton Convex client + provider component |
| `src/hooks/useEnsureUser.ts` | Clerk→Convex identity bridge, called on every auth page |
| `middleware.ts` | HTTP-level route protection via Clerk |
