import type { NextFunction, Request, Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { auth } from "../lib/firebaseAdmin.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      uid?: string;
      authClaims?: DecodedIdToken;
    }
  }
}

/**
 * Verifies the `Authorization: Bearer <Firebase ID token>` header (api-contracts.md §0)
 * and attaches `req.uid` / `req.authClaims` on success. 401s otherwise — never trusts
 * a client-supplied uid (hld.md §10).
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!auth) {
    return res.status(503).json({
      error: { code: "AUTH_NOT_CONFIGURED", message: "Firebase Auth is not configured on this server" }
    });
  }

  const header = req.header("Authorization") ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Missing or malformed Authorization header" }
    });
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    req.uid = decoded.uid;
    req.authClaims = decoded;
    return next();
  } catch (err) {
    console.error("[requireAuth] token verification failed", err);
    return res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Invalid or expired token" }
    });
  }
}
