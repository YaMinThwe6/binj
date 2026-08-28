import { Router } from "express";
import { db } from "../lib/firebaseAdmin.js";
import { requireAuth } from "../middleware/auth.js";

export const usersRouter = Router();

const USERNAME_RE = /^[a-z0-9._]{3,20}$/;

interface UserDoc {
  uid: string;
  displayName: string;
  username: string | null;
  email: string;
  photoURL: string | null;
  createdAt: FirebaseFirestore.Timestamp | Date;
  listVisible: boolean;
  followRequiresApproval: boolean;
  status: "active" | "restricted" | "suspended";
  statusExpiresAt: null;
  favoriteGenres: string[] | null;
  preferredLanguages: string[] | null;
  onboardingComplete: boolean;
  notificationPrefs: { emailEnabled: boolean };
  themePreference: "dark" | "light" | "system";
  accentTheme: "emerald" | "cyan" | "purple" | "pink" | "amber" | "red";
}

function toResponse(doc: UserDoc, isNewUser = false) {
  const { statusExpiresAt: _statusExpiresAt, createdAt: _createdAt, ...rest } = doc;
  return { ...rest, isNewUser };
}

// Shared by GET's bootstrap and PATCH's self-heal path below — a user doc should
// always exist by the time PATCH runs (GET /users/me creates it lazily), but PATCH
// must not *depend* on that ordering: a client that PATCHes before ever GETting
// (or a doc that's gone missing for any other reason) should still get a valid
// profile back, not a 502 "Failed to update user profile".
function buildDefaultUserDoc(uid: string, claims: { name?: string; email?: string; picture?: string }): UserDoc {
  return {
    uid,
    displayName: claims.name ?? claims.email?.split("@")[0] ?? "New user",
    username: null,
    email: claims.email ?? "",
    photoURL: claims.picture ?? null,
    createdAt: new Date(),
    listVisible: true,
    followRequiresApproval: false,
    status: "active",
    statusExpiresAt: null,
    favoriteGenres: null,
    preferredLanguages: null,
    onboardingComplete: false,
    notificationPrefs: { emailEnabled: true },
    themePreference: "dark",
    accentTheme: "emerald"
  };
}

// GET /users/me — lazy bootstrap-or-fetch pattern, api-contracts.md §11 / hld.md §13.
// No POST /users: a brand-new verified token creates the profile right here.
// isNewUser is true only on this exact bootstrap call (hld.md §13) — the frontend's
// actual "show onboarding" check is isNewUser || !onboardingComplete.
usersRouter.get("/users/me", requireAuth, async (req, res) => {
  if (!db) {
    return res.status(503).json({
      error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured on this server" }
    });
  }

  const uid = req.uid as string;
  const claims = req.authClaims!;

  try {
    const ref = db.collection("users").doc(uid);
    const snap = await ref.get();

    if (snap.exists) {
      return res.json(toResponse(snap.data() as UserDoc, false));
    }

    const newUser = buildDefaultUserDoc(uid, claims);
    await ref.set(newUser);
    return res.status(200).json(toResponse(newUser, true));
  } catch (err) {
    console.error(`[GET /users/me] uid=${uid}`, err);
    return res.status(502).json({
      error: { code: "FIRESTORE_ERROR", message: "Failed to load or create user profile" }
    });
  }
});

// GET /users/username-available — api-contracts.md §11. Unauthenticated: needed
// before an account necessarily exists to attach a reservation to (checked live
// during onboarding step 3, before the PATCH that actually claims it).
usersRouter.get("/users/username-available", async (req, res) => {
  if (!db) {
    return res.status(503).json({
      error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured on this server" }
    });
  }

  const username = String(req.query.username ?? "").trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({
      error: { code: "INVALID_USERNAME", message: "Username must be 3-20 characters: lowercase letters, numbers, dots, underscores" }
    });
  }

  try {
    const snap = await db.collection("usernames").doc(username).get();
    return res.json({ available: !snap.exists });
  } catch (err) {
    console.error(`[GET /users/username-available] username=${username}`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to check username" } });
  }
});

const SIMPLE_PATCHABLE_FIELDS = [
  "displayName",
  "listVisible",
  "followRequiresApproval",
  "favoriteGenres",
  "preferredLanguages",
  "onboardingComplete",
  "themePreference",
  "accentTheme"
] as const;

// PATCH /users/me — api-contracts.md §11. `username` is handled separately from
// the other fields since claiming one needs a transactional uniqueness check
// against usernames/{username} (schema.md) — everything else is a plain update.
usersRouter.patch("/users/me", requireAuth, async (req, res) => {
  if (!db) {
    return res.status(503).json({
      error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured on this server" }
    });
  }

  const uid = req.uid as string;
  const claims = req.authClaims!;
  const updates: Record<string, unknown> = {};

  for (const field of SIMPLE_PATCHABLE_FIELDS) {
    if (field in req.body) {
      updates[field] = req.body[field];
    }
  }

  const wantsUsername = "username" in req.body;
  let newUsername: string | null = null;
  if (wantsUsername) {
    newUsername = String(req.body.username ?? "").trim().toLowerCase();
    if (!USERNAME_RE.test(newUsername)) {
      return res.status(400).json({
        error: { code: "INVALID_USERNAME", message: "Username must be 3-20 characters: lowercase letters, numbers, dots, underscores" }
      });
    }
  }

  if (Object.keys(updates).length === 0 && !wantsUsername) {
    return res.status(400).json({
      error: { code: "NO_UPDATABLE_FIELDS", message: "No recognized fields in request body" }
    });
  }

  const userRef = db.collection("users").doc(uid);

  try {
    if (wantsUsername) {
      const firestore = db;
      const usernameRef = firestore.collection("usernames").doc(newUsername!);
      await firestore.runTransaction(async (tx) => {
        const [usernameSnap, userSnap] = await Promise.all([tx.get(usernameRef), tx.get(userRef)]);
        if (usernameSnap.exists && usernameSnap.data()?.uid !== uid) {
          throw Object.assign(new Error("USERNAME_TAKEN"), { code: "USERNAME_TAKEN" });
        }
        const oldUsername = userSnap.data()?.username as string | null | undefined;
        if (oldUsername && oldUsername !== newUsername) {
          tx.delete(firestore.collection("usernames").doc(oldUsername));
        }
        tx.set(usernameRef, { uid });
        // Self-heal: if the profile doc doesn't exist yet (PATCH reached us before
        // GET /users/me ever bootstrapped it), build it now instead of failing —
        // tx.update() would throw NOT_FOUND on a missing doc.
        const base = userSnap.exists ? (userSnap.data() as UserDoc) : buildDefaultUserDoc(uid, claims);
        tx.set(userRef, { ...base, ...updates, username: newUsername });
      });
    } else {
      const userSnap = await userRef.get();
      const base = userSnap.exists ? (userSnap.data() as UserDoc) : buildDefaultUserDoc(uid, claims);
      await userRef.set({ ...base, ...updates });
    }

    const snap = await userRef.get();
    return res.json(toResponse(snap.data() as UserDoc, false));
  } catch (err) {
    if ((err as { code?: string }).code === "USERNAME_TAKEN") {
      return res.status(409).json({ error: { code: "USERNAME_TAKEN", message: "That username is already taken" } });
    }
    console.error(`[PATCH /users/me] uid=${uid}`, err);
    return res.status(502).json({
      error: { code: "FIRESTORE_ERROR", message: "Failed to update user profile" }
    });
  }
});
