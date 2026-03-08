"use client";

/**
 * AddRecommendationForm Component
 *
 * Controlled form that calls the `createRecommendation` Convex mutation.
 * Validates inputs client-side for UX, then relies on server-side validation
 * in Convex as the authoritative check.
 *
 * On success: redirects to /recs.
 * On error: displays the error message inline.
 */

import { useState } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../convex/_generated/api";

const GENRES = [
  "Action",
  "Comedy",
  "Drama",
  "Horror",
  "Sci-Fi",
  "Thriller",
  "Animation",
  "Documentary",
  "Romance",
  "Fantasy",
  "Other",
];

export function AddRecommendationForm() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const createRec = useMutation(api.recommendations.createRecommendation);

  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [customGenre, setCustomGenre] = useState("");
  const [link, setLink] = useState("");
  const [blurb, setBlurb] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Resolved genre — either the dropdown value or the custom input
  const resolvedGenre = genre === "Other" ? customGenre.trim() : genre;

  function validate(): string | null {
    if (!title.trim()) return "Title is required";
    if (title.trim().length > 120) return "Title must be under 120 characters";
    if (!resolvedGenre) return "Genre is required";
    if (!blurb.trim()) return "Blurb is required";
    if (blurb.trim().length > 300) return "Blurb must be under 300 characters";
    if (!link.trim()) return "Link is required";
    try {
      const url = new URL(link.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return "Link must start with https:// or http://";
      }
    } catch {
      return "Invalid URL — must start with https://";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await createRec({
        title: title.trim(),
        genre: resolvedGenre,
        link: link.trim(),
        blurb: blurb.trim(),
      });
      router.push("/recs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3"
        >
          {error}
        </div>
      )}

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium text-gray-700">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Dune: Part Two"
          maxLength={120}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
          required
        />
        <span className="text-xs text-gray-400 text-right">{title.length}/120</span>
      </div>

      {/* Genre */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="genre" className="text-sm font-medium text-gray-700">
          Genre <span className="text-red-500">*</span>
        </label>
        <select
          id="genre"
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition bg-white"
          required
        >
          <option value="" disabled>
            Select a genre
          </option>
          {GENRES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        {/* Custom genre input when "Other" is selected */}
        {genre === "Other" && (
          <input
            type="text"
            value={customGenre}
            onChange={(e) => setCustomGenre(e.target.value)}
            placeholder="Enter genre name"
            maxLength={60}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition mt-1"
          />
        )}
      </div>

      {/* Link */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="link" className="text-sm font-medium text-gray-700">
          Link <span className="text-red-500">*</span>
        </label>
        <input
          id="link"
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://www.imdb.com/title/..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
          required
        />
      </div>

      {/* Blurb */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="blurb" className="text-sm font-medium text-gray-700">
          Why you love it <span className="text-red-500">*</span>
        </label>
        <textarea
          id="blurb"
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
          placeholder="A short take on why this is worth watching..."
          maxLength={300}
          rows={3}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition resize-none"
          required
        />
        <span className="text-xs text-gray-400 text-right">{blurb.length}/300</span>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting || !isAuthenticated}
        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
      >
        {!isAuthenticated ? "Connecting…" : submitting ? "Adding…" : "Add to Shelf"}
      </button>
    </form>
  );
}
