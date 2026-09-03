import type { UserProfile, PublicProfile } from "@binj/shared-types";
import { requireDb } from "../lib/firebaseAdmin.js";
import { AppError } from "../utils/AppError.js";

const USERNAME_RE = /^[a-z0-9._]{3,30}$/;

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

interface Claims {
  name?: string;
  email?: string;
  picture?: string;
}

// Return type is the shared UserProfile DTO (@binj/shared-types) — the wire
// contract both frontend and backend agree on, distinct from UserDoc above
// (internal storage shape, Firestore Timestamps included) by construction.
function toResponse(doc: UserDoc, isNewUser = false): UserProfile {
  const { statusExpiresAt: _statusExpiresAt, createdAt: _createdAt, ...rest } = doc;
  return { ...rest, isNewUser };
}

// Shared by getOrCreateUser's bootstrap and updateUser's self-heal path below
// — a user doc should always exist by the time PATCH runs (GET /users/me
// creates it lazily), but PATCH must not *depend* on that ordering.
function buildDefaultUserDoc(uid: string, claims: Claims): UserDoc {
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
export async function getOrCreateUser(uid: string, claims: Claims): Promise<UserProfile> {
  const db = requireDb();
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();

  if (snap.exists) {
    return toResponse(snap.data() as UserDoc, false);
  }

  const newUser = buildDefaultUserDoc(uid, claims);
  await ref.set(newUser);
  return toResponse(newUser, true);
}

// GET /users/username-available — api-contracts.md §11. Unauthenticated: needed
// before an account necessarily exists to attach a reservation to (checked live
// during onboarding step 3, before the PATCH that actually claims it).
export async function isUsernameAvailable(rawUsername: string): Promise<boolean> {
  const username = rawUsername.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    throw new AppError("INVALID_USERNAME", "Username must be 3-30 characters: lowercase letters, numbers, dots, underscores", 400);
  }

  const db = requireDb();
  const snap = await db.collection("usernames").doc(username).get();
  return !snap.exists;
}

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
export async function updateUser(uid: string, claims: Claims, body: Record<string, unknown>): Promise<UserProfile> {
  const db = requireDb();
  const updates: Record<string, unknown> = {};

  for (const field of SIMPLE_PATCHABLE_FIELDS) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  const wantsUsername = "username" in body;
  let newUsername: string | null = null;
  if (wantsUsername) {
    newUsername = String(body.username ?? "").trim().toLowerCase();
    if (!USERNAME_RE.test(newUsername)) {
      throw new AppError("INVALID_USERNAME", "Username must be 3-30 characters: lowercase letters, numbers, dots, underscores", 400);
    }
  }

  if (Object.keys(updates).length === 0 && !wantsUsername) {
    throw new AppError("NO_UPDATABLE_FIELDS", "No recognized fields in request body", 400);
  }

  const userRef = db.collection("users").doc(uid);

  if (wantsUsername) {
    const usernameRef = db.collection("usernames").doc(newUsername!);
    await db.runTransaction(async (tx) => {
      const [usernameSnap, userSnap] = await Promise.all([tx.get(usernameRef), tx.get(userRef)]);
      if (usernameSnap.exists && usernameSnap.data()?.uid !== uid) {
        throw new AppError("USERNAME_TAKEN", "That username is already taken", 409);
      }
      const oldUsername = userSnap.data()?.username as string | null | undefined;
      if (oldUsername && oldUsername !== newUsername) {
        tx.delete(db.collection("usernames").doc(oldUsername));
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
  return toResponse(snap.data() as UserDoc, false);
}

function toIso(value: FirebaseFirestore.Timestamp | Date | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value.toDate().toISOString();
}

// Preview cap for the watched list shown on a public profile — not a
// paginated list (that's GET /users/me/watched for the owner's own view),
// just enough for a "recently watched" section. Fetched unlimited-then-
// filtered-then-sliced (not a Firestore .limit()) so a mostly-private list
// doesn't undercount the public entries that actually exist.
const PROFILE_WATCHED_PREVIEW = 12;

// GET /users/:uid — api-contracts.md §11b, hld.md §5a/§8. The public-facing
// counterpart to GET /users/me: same privacy rules as getMovieWatchedBy
// (list-level users.listVisible + per-entry watched.visibility), just not
// scoped to the caller's `following` list here — profile info is public.
export async function getPublicProfile(callerUid: string, targetUid: string): Promise<PublicProfile> {
  const db = requireDb();
  const targetRef = db.collection("users").doc(targetUid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    throw new AppError("USER_NOT_FOUND", "No such user", 404);
  }
  const target = targetSnap.data() as UserDoc;

  const [followersSnap, followingSnap] = await Promise.all([
    targetRef.collection("followers").get(),
    targetRef.collection("following").get()
  ]);

  let relationship: PublicProfile["relationship"];
  if (targetUid === callerUid) {
    relationship = "self";
  } else {
    const [followingCallerSnap, requestSnap] = await Promise.all([
      db.collection("users").doc(callerUid).collection("following").doc(targetUid).get(),
      targetRef.collection("followRequests").doc(callerUid).get()
    ]);
    relationship = followingCallerSnap.exists ? "following" : requestSnap.exists ? "pending" : "none";
  }

  const watchedListVisible = target.listVisible === true;
  let watched: PublicProfile["watched"] = [];
  if (watchedListVisible) {
    const watchedSnap = await targetRef.collection("watched").orderBy("watchedAt", "desc").get();
    const publicEntries = watchedSnap.docs
      .filter((d) => d.data().visibility !== "private")
      .slice(0, PROFILE_WATCHED_PREVIEW);
    watched = await Promise.all(
      publicEntries.map(async (d) => {
        const movieSnap = await db.collection("movies").doc(d.id).get();
        return {
          movieId: d.id,
          title: movieSnap.data()?.title ?? null,
          poster: movieSnap.data()?.poster ?? null,
          watchedAt: toIso(d.data().watchedAt ?? null)
        };
      })
    );
  }

  return {
    uid: targetUid,
    displayName: target.displayName,
    username: target.username,
    photoURL: target.photoURL,
    favoriteGenres: target.favoriteGenres,
    preferredLanguages: target.preferredLanguages,
    followerCount: followersSnap.docs.length,
    followingCount: followingSnap.docs.length,
    relationship,
    watchedListVisible,
    watched
  };
}
