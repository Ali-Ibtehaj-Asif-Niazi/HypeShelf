"use client";

/**
 * Authenticated Recommendations Page  —  /recs
 *
 * Protected by Clerk middleware (unauthenticated users are redirected).
 * Shows all recommendations with real-time updates from Convex.
 *
 * Features:
 *  - Genre filter bar (client-side filtering over the full dataset)
 *  - Delete button on own recs (users) or any rec (admin)
 *  - Staff Pick toggle button (admin only)
 *  - Link to /add
 */

import { useConvexAuth, useQuery, useMutation } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Header } from "@/components/Header";
import { RecommendationCard } from "@/components/RecommendationCard";
import { FilterBar } from "@/components/FilterBar";
import { useEnsureUser } from "@/hooks/useEnsureUser";
import { useMemo, useState } from "react";

export default function RecsPage() {
  // Syncs Clerk identity → Convex users table on mount
  useEnsureUser();

  // Wait for Convex to receive and validate the Clerk JWT before firing queries.
  // Without this guard, queries run during the brief window where the Convex
  // client has no auth token yet (right after sign-in) and throw "Not authenticated".
  const { isAuthenticated } = useConvexAuth();

  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  // "skip" tells Convex not to subscribe until isAuthenticated is true
  const recs = useQuery(api.recommendations.getAllRecommendations, isAuthenticated ? {} : "skip");
  const me = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");

  const deleteMutation = useMutation(api.recommendations.deleteRecommendation);
  const staffPickMutation = useMutation(api.recommendations.markStaffPick);

  // Derive unique genre list from fetched data (avoids a separate query)
  const genres = useMemo(() => {
    if (!recs) return [];
    return Array.from(new Set(recs.map((r) => r.genre))).sort();
  }, [recs]);

  // Client-side genre filter
  const filteredRecs = useMemo(() => {
    if (!recs) return [];
    if (!selectedGenre) return recs;
    return recs.filter((r) => r.genre === selectedGenre);
  }, [recs, selectedGenre]);

  const isAdmin = me?.role === "admin";

  async function handleDelete(id: Id<"recommendations">) {
    if (!confirm("Delete this recommendation?")) return;
    try {
      await deleteMutation({ id });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function handleToggleStaffPick(
    id: Id<"recommendations">,
    current: boolean
  ) {
    try {
      await staffPickMutation({ id, staffPick: !current });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update");
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-10">
        {/* Page header row */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">All Picks</h1>
          <Link
            href="/add"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Add Recommendation
          </Link>
        </div>

        {/* Genre filter */}
        <FilterBar
          genres={genres}
          selected={selectedGenre}
          onChange={setSelectedGenre}
        />

        {/* Loading */}
        {recs === undefined && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-44 bg-white rounded-xl border border-gray-100 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {recs !== undefined && filteredRecs.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            {selectedGenre ? (
              <p>No picks in &ldquo;{selectedGenre}&rdquo; yet.</p>
            ) : (
              <>
                <p className="text-lg">Nothing here yet.</p>
                <Link
                  href="/add"
                  className="text-indigo-600 hover:underline text-sm mt-1 inline-block"
                >
                  Be the first to add something →
                </Link>
              </>
            )}
          </div>
        )}

        {/* Recs grid */}
        {filteredRecs.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-6">
            {filteredRecs.map((rec) => (
              <RecommendationCard
                key={rec._id}
                rec={rec}
                isAdmin={isAdmin}
                isOwner={me?._id === rec.userId}
                onDelete={() => handleDelete(rec._id)}
                onToggleStaffPick={() =>
                  handleToggleStaffPick(rec._id, rec.staffPick)
                }
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
