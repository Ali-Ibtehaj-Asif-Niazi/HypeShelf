"use client";

/**
 * RecommendationCard Component
 *
 * Renders a single recommendation.
 * Staff Picks get an amber highlight border + star badge.
 *
 * Props:
 *   rec            — recommendation data + joined userName
 *   isAdmin        — show admin controls (Staff Pick toggle, delete any)
 *   isOwner        — show owner controls (delete own)
 *   showAuthor     — whether to display the author name (false on public page)
 *   onDelete       — callback for delete action
 *   onToggleStaffPick — callback for staff pick toggle (admin only)
 */

import { Id } from "../../convex/_generated/dataModel";

type RecWithUser = {
  _id: Id<"recommendations">;
  title: string;
  genre: string;
  link: string;
  blurb: string;
  userId: Id<"users">;
  createdAt: number;
  staffPick: boolean;
  userName: string;
};

interface RecommendationCardProps {
  rec: RecWithUser;
  isAdmin: boolean;
  isOwner: boolean;
  showAuthor?: boolean;
  onDelete?: () => void;
  onToggleStaffPick?: () => void;
}

export function RecommendationCard({
  rec,
  isAdmin,
  isOwner,
  showAuthor = true,
  onDelete,
  onToggleStaffPick,
}: RecommendationCardProps) {
  const canDelete = isOwner || isAdmin;
  const formattedDate = new Date(rec.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <article
      className={`
        relative bg-white rounded-xl border shadow-sm flex flex-col transition-shadow hover:shadow-md
        ${rec.staffPick
          ? "border-amber-400 ring-1 ring-amber-300"
          : "border-gray-200"
        }
      `}
    >
      {/* Staff Pick badge */}
      {rec.staffPick && (
        <div className="absolute -top-3 left-4">
          <span className="inline-flex items-center gap-1 bg-amber-400 text-amber-900 text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm">
            <span>★</span> Staff Pick
          </span>
        </div>
      )}

      <div className={`p-4 flex flex-col gap-2 flex-1 ${rec.staffPick ? "pt-5" : ""}`}>
        {/* Genre tag */}
        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-500 bg-indigo-50 rounded-full px-2 py-0.5 self-start">
          {rec.genre}
        </span>

        {/* Title */}
        <h3 className="text-base font-bold text-gray-900 leading-snug">
          {rec.title}
        </h3>

        {/* Blurb */}
        <p className="text-sm text-gray-600 leading-relaxed flex-1 line-clamp-3">
          {rec.blurb}
        </p>

        {/* Footer row */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-auto">
          <div className="flex flex-col">
            {showAuthor && (
              <span className="text-xs font-medium text-gray-700">
                {rec.userName}
              </span>
            )}
            <span className="text-xs text-gray-400">{formattedDate}</span>
          </div>

          <a
            href={rec.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
          >
            View →
          </a>
        </div>
      </div>

      {/* Admin / owner action bar */}
      {(canDelete || isAdmin) && (
        <div className="flex items-center gap-2 px-4 pb-3 border-t border-gray-100 pt-2">
          {/* Admin-only: Staff Pick toggle */}
          {isAdmin && onToggleStaffPick && (
            <button
              onClick={onToggleStaffPick}
              className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                rec.staffPick
                  ? "border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
              title={rec.staffPick ? "Remove Staff Pick" : "Mark as Staff Pick"}
            >
              {rec.staffPick ? "★ Remove Pick" : "☆ Staff Pick"}
            </button>
          )}

          {/* Delete — own recs for users, any rec for admins */}
          {canDelete && onDelete && (
            <button
              onClick={onDelete}
              className="ml-auto text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded-full border border-transparent hover:border-red-200 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </article>
  );
}
