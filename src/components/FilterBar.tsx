"use client";

/**
 * FilterBar Component
 *
 * Renders genre filter pill buttons.
 * "All" clears the filter. Clicking an active genre deselects it.
 * Derived genres come from the parent (no extra query needed).
 */

interface FilterBarProps {
  genres: string[];
  selected: string | null;
  onChange: (genre: string | null) => void;
}

export function FilterBar({ genres, selected, onChange }: FilterBarProps) {
  if (genres.length === 0) return null;

  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Filter by genre"
    >
      {/* "All" pill */}
      <button
        onClick={() => onChange(null)}
        className={`text-sm font-medium px-3 py-1.5 rounded-full border transition-colors ${
          selected === null
            ? "bg-indigo-600 text-white border-indigo-600"
            : "bg-white text-gray-600 border-gray-200 hover:border-indigo-400 hover:text-indigo-600"
        }`}
      >
        All
      </button>

      {genres.map((genre) => (
        <button
          key={genre}
          onClick={() => onChange(selected === genre ? null : genre)}
          className={`text-sm font-medium px-3 py-1.5 rounded-full border transition-colors ${
            selected === genre
              ? "bg-indigo-600 text-white border-indigo-600"
              : "bg-white text-gray-600 border-gray-200 hover:border-indigo-400 hover:text-indigo-600"
          }`}
        >
          {genre}
        </button>
      ))}
    </div>
  );
}
