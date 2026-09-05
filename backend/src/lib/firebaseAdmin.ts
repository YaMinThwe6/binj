import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { env, firebaseConfigured } from "./env.js";
import { logger } from "./logger.js";
import { AppError } from "../utils/AppError.js";

let db: Firestore | null = null;
let auth: Auth | null = null;

if (firebaseConfigured) {
  // Local dev supplies a service-account key file via GOOGLE_APPLICATION_CREDENTIALS;
  // Cloud Run doesn't need one at all — its attached service account already
  // provides Application Default Credentials, which firebase-admin picks up
  // automatically when no explicit `credential` is given.
  const app: App = getApps()[0] ?? initializeApp(
    env.GOOGLE_APPLICATION_CREDENTIALS
      ? { credential: cert(env.GOOGLE_APPLICATION_CREDENTIALS), projectId: env.FIREBASE_PROJECT_ID }
      : { projectId: env.FIREBASE_PROJECT_ID }
  );
  db = getFirestore(app);
  auth = getAuth(app);
} else {
  logger.warn(
    "[firebaseAdmin] FIREBASE_PROJECT_ID / GOOGLE_APPLICATION_CREDENTIALS not set — " +
    "Firestore-backed routes will fall back to TMDB-only behaviour until a Firebase project is wired up."
  );
}

export { db, auth };
export const isFirebaseConfigured = () => firebaseConfigured;

// Every service function that touches Firestore starts with this instead of
// its own `if (!db) return res.status(503)...` — one place declares the
// "Firestore isn't configured" contract, services just get a non-null `db`.
export function requireDb(): Firestore {
  if (!db) {
    throw new AppError("FIRESTORE_NOT_CONFIGURED", "Firestore is not configured on this server", 503);
  }
  return db;
}

// Same idea as requireDb(), for the handful of services that need the
// Firebase Auth Admin SDK directly (currently just auth.service.ts).
export function requireFirebaseAuth(): Auth {
  if (!auth) {
    throw new AppError("FIREBASE_NOT_CONFIGURED", "Firebase is not configured on this server", 503);
  }
  return auth;
}
