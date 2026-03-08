"use client";

/**
 * Header Component
 *
 * Shared across all pages.
 * Shows the HypeShelf logo, nav links for authenticated users,
 * and Clerk's SignInButton / UserButton for auth state management.
 */

import Link from "next/link";
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";

export function Header() {
  const { isSignedIn, isLoaded } = useUser();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="text-xl font-extrabold text-indigo-600 tracking-tight hover:opacity-80 transition-opacity"
        >
          HypeShelf
        </Link>

        {/* Nav */}
        {isLoaded && (
          <nav className="flex items-center gap-4">
            {isSignedIn ? (
              <>
                <Link
                  href="/recs"
                  className="text-sm text-gray-600 hover:text-indigo-600 font-medium transition-colors"
                >
                  Browse
                </Link>
                <Link
                  href="/add"
                  className="text-sm text-gray-600 hover:text-indigo-600 font-medium transition-colors"
                >
                  Add Pick
                </Link>
                {/* Clerk's pre-built user avatar + dropdown (sign out, profile, etc.) */}
                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <>
                <SignInButton mode="modal">
                  <button className="text-sm text-gray-600 hover:text-indigo-600 font-medium transition-colors">
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors">
                    Sign up
                  </button>
                </SignUpButton>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
