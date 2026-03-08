"use client";

/**
 * Add Recommendation Page  —  /add
 *
 * Protected by Clerk middleware.
 * Renders the AddRecommendationForm and handles the post-submit redirect.
 */

import { Header } from "@/components/Header";
import { AddRecommendationForm } from "@/components/AddRecommendationForm";
import { useEnsureUser } from "@/hooks/useEnsureUser";
import Link from "next/link";

export default function AddPage() {
  // Ensures the Convex user record exists before the form can submit
  useEnsureUser();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/recs"
            className="text-sm text-indigo-600 hover:underline"
          >
            ← Back to picks
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          Add a Recommendation
        </h1>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <AddRecommendationForm />
        </div>
      </main>
    </div>
  );
}
