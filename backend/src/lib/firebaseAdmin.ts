import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { env, firebaseConfigured } from "./env.js";
import { logger } from "./logger.js";

let db: Firestore | null = null;
let auth: Auth | null = null;

if (firebaseConfigured) {
  const app: App = getApps()[0] ?? initializeApp({
    credential: cert(env.GOOGLE_APPLICATION_CREDENTIALS as string),
    projectId: env.FIREBASE_PROJECT_ID
  });
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
