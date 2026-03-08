"use client";

/**
 * useEnsureUser Hook
 *
 * Syncs the currently authenticated Clerk user into the Convex `users` table.
 * Must be called on every authenticated page mount.
 *
 * Why: Convex stores its own user records (with roles) keyed by Clerk ID.
 *      This hook bridges the gap between Clerk identity and Convex user record.
 *
 * Safety:
 *  - The `upsertUser` mutation is idempotent — safe to call on every render
 *  - It only fires when `isLoaded` is true and a user is signed in
 *  - Role is never passed from client; Convex sets it to "user" on first creation
 */

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useEnsureUser() {
  const { user, isLoaded } = useUser();
  const upsertUser = useMutation(api.users.upsertUser);

  useEffect(() => {
    if (!isLoaded || !user) return;

    // Resolve the best available display name from Clerk
    const name =
      user.fullName ??
      user.username ??
      user.primaryEmailAddress?.emailAddress ??
      "Anonymous";

    upsertUser({ name }).catch(console.error);
    // We intentionally omit `upsertUser` from deps — it's a stable mutation ref
    // and including it would cause an infinite loop with some Convex versions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user?.id]);
}
