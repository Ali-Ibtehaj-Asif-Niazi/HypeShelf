import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes that require a signed-in user
const isProtectedRoute = createRouteMatcher(["/recs(.*)", "/add(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // Redirect unauthenticated users to Clerk's sign-in page
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  // Run middleware on all routes except Next.js internals and static files
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)","/(api|trpc)(.*)"],
};
