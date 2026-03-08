"use client";

/**
 * Public Landing Page  —  /
 *
 * Visible to everyone (no auth required).
 * Shows the latest 20 recommendations from Convex in real-time.
 * Staff Picks are visually highlighted.
 * Unauthenticated visitors see a CTA to sign in.
 */

import { useQuery } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { api } from "../../convex/_generated/api";
import { Header } from "@/components/Header";
import { RecommendationCard } from "@/components/RecommendationCard";

export default function HomePage() {
  const { isSignedIn } = useUser();
  // Public query — works without auth
  const recs = useQuery(api.recommendations.getLatestRecommendations);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <h1 className="text-5xl font-extrabold text-indigo-600 tracking-tight mb-3">
            HypeShelf
          </h1>
          <p className="text-xl text-gray-500 mb-8">
            Collect and share the stuff you&apos;re hyped about.
          </p>

          {isSignedIn ? (
            <Link
              href="/recs"
              className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Go to My Shelf →
            </Link>
          ) : (
            <SignInButton mode="modal">
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors">
                Sign in to add yours
              </button>
            </SignInButton>
          )}
        </div>
      </section>

      {/* Latest Recommendations */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Latest Picks</h2>
          {/* Staff Pick legend */}
          <span className="flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
            <span className="text-amber-500">★</span> Staff Pick
          </span>
        </div>

        {/* Loading skeleton */}
        {recs === undefined && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-44 bg-white rounded-xl border border-gray-100 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {recs !== undefined && recs.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">No recommendations yet.</p>
            <p className="text-sm mt-1">Be the first to add something!</p>
          </div>
        )}

        {/* Rec grid */}
        {recs !== undefined && recs.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recs.map((rec) => (
              <RecommendationCard
                key={rec._id}
                rec={rec}
                isAdmin={false}
                isOwner={false}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-100">
        HypeShelf — share what you&apos;re hyped about.
      </footer>
    </div>
  );
}
