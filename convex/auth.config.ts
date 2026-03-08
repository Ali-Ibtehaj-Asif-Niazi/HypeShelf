/**
 * Convex Auth Configuration
 *
 * This tells Convex to trust JWTs issued by your Clerk instance.
 * When a client calls a Convex function, the Clerk JWT is forwarded
 * and Convex verifies it against this config before populating `ctx.auth`.
 *
 * Setup steps:
 *  1. In Clerk Dashboard → JWT Templates → create a template named "convex"
 *     (Use the Convex preset — it sets the correct audience claim)
 *  2. Copy the "Issuer" URL from that template
 *  3. Set CLERK_JWT_ISSUER_DOMAIN in your .env.local to that URL
 *  4. Set the same value as a Convex environment variable in the Convex dashboard
 */
export default {
  providers: [
    {
      // The issuer URL from your Clerk JWT template (e.g. https://clerk.xxx.dev)
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN as string,
      applicationID: "convex",
    },
  ],
};
