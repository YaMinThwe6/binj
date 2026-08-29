import type { NextFunction, Request, Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { auth } from "../lib/firebaseAdmin.js";
import { logger } from "../lib/logger.js";
import { Responder } from "../utils/responder.js";

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
    return Responder.error(res, "AUTH_NOT_CONFIGURED", "Firebase Auth is not configured on this server", 503);
  }

  const header = req.header("Authorization") ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return Responder.error(res, "UNAUTHENTICATED", "Missing or malformed Authorization header", 401);
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    req.uid = decoded.uid;
    req.authClaims = decoded;
    return next();
  } catch (err) {
    logger.error("[requireAuth] token verification failed", err);
    return Responder.error(res, "UNAUTHENTICATED", "Invalid or expired token", 401);
  }
}
