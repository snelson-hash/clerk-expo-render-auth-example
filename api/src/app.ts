import express, { type ErrorRequestHandler } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { allowedParty, nativeBearer, parties, safeReason } from "./policy.js";

export function createApp(env: NodeJS.ProcessEnv = process.env) {
  if (!env.CLERK_PUBLISHABLE_KEY || !env.CLERK_SECRET_KEY || !env.CLERK_EXPECTED_ISSUER) {
    throw new Error("Required reproduction configuration is missing");
  }
  if (env.CLERK_PROXY_ENABLED !== "false") {
    throw new Error("This reproduction supports the proxy-disabled configuration only");
  }
  const app = express();
  app.disable("x-powered-by");
  app.use(clerkMiddleware(req => ({
    secretKey: env.CLERK_SECRET_KEY,
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
    authorizedParties: nativeBearer(req.headers) ? undefined : parties(env.CLERK_AUTHORIZED_PARTIES),
    // Absent in baseline. Only used by isolated synthetic verification tests,
    // or a separately reviewed operator configuration; no key is checked in.
    ...(env.CLERK_JWT_KEY ? { jwtKey: env.CLERK_JWT_KEY } : {}),
  })));
  app.get("/api/protected", (req, res) => {
    res.set("Cache-Control", "no-store");
    const auth = getAuth(req);
    if (!auth.userId || !auth.sessionClaims) {
      res.status(401).json({
        error: "unauthorized",
        category: safeReason(res.getHeader("x-clerk-auth-reason")),
      });
      return;
    }
    if (!allowedParty(auth.sessionClaims, nativeBearer(req.headers), parties(env.CLERK_AUTHORIZED_PARTIES))) {
      res.status(401).json({ error: "unauthorized", category: "authorized-party-mismatch" });
      return;
    }
    // Source application checks this during identity resolution after Clerk
    // verification. No identity mapping/database is included here.
    if (auth.sessionClaims.iss !== env.CLERK_EXPECTED_ISSUER) {
      res.status(401).json({ error: "unauthorized", category: "issuer-mismatch" });
      return;
    }
    res.json({ ok: true }); // No claims or identity in the response.
  });
  const errors: ErrorRequestHandler = (_error, _req, res, _next) => {
    // Never print/serialize arbitrary SDK errors or Express development stacks.
    res.status(500).set("Cache-Control", "no-store").json({ error: "server-error" });
  };
  app.use(errors);
  return app;
}
