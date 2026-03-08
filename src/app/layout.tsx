import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/lib/ConvexClientProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "HypeShelf",
  description: "Collect and share the stuff you're hyped about.",
};

/**
 * Root Layout
 *
 * Provider order matters:
 *   ClerkProvider  →  provides Clerk auth context (useUser, useAuth, etc.)
 *   ConvexClientProvider  →  uses Clerk's useAuth internally to forward JWTs
 *
 * Both providers are client-side under the hood (they use context),
 * but this file itself is a Server Component — the providers handle
 * the client boundary internally.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="bg-gray-50 text-gray-900 antialiased" suppressHydrationWarning>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
