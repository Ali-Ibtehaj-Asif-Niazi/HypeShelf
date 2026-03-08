"use client";

/**
 * ConvexClientProvider
 *
 * Wraps children with Convex's real-time client, authenticated via Clerk.
 * `ConvexProviderWithClerk` intercepts Clerk's auth state and forwards the
 * Clerk JWT to Convex so that `ctx.auth.getUserIdentity()` works server-side.
 *
 * Must be a Client Component because it uses React context and hooks.
 */

import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";

// Singleton client — created once at module load, reused across renders
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // useAuth is passed as a prop so Convex can subscribe to Clerk's auth state
    // and refresh the JWT automatically when it expires
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
