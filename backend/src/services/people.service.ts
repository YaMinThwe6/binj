import type { TasteMatch } from "@binj/shared-types";
import { requireDb } from "../lib/firebaseAdmin.js";
import { AppError } from "../utils/AppError.js";

// GET /users/me/tasteMatches — api-contracts.md §5, hld.md §5b.
// Read-only: precomputed by scripts/computeTasteMatches.ts (or the future
// cron+BigQuery pipeline it stands in for) — no write endpoint here.
export async function getTasteMatches(uid: string): Promise<{ items: TasteMatch[] }> {
  const db = requireDb();
  const snap = await db.collection("users").doc(uid).collection("tasteMatches").orderBy("score", "desc").get();

  const items = await Promise.all(
    snap.docs.map(async (matchDoc): Promise<TasteMatch> => {
      const [userSnap, followingSnap, requestSnap] = await Promise.all([
        db.collection("users").doc(matchDoc.id).get(),
        db.collection("users").doc(uid).collection("following").doc(matchDoc.id).get(),
        db.collection("users").doc(matchDoc.id).collection("followRequests").doc(uid).get()
      ]);
      const relationship = followingSnap.exists ? "following" : requestSnap.exists ? "pending" : "none";
      return {
        uid: matchDoc.id,
        displayName: userSnap.data()?.displayName ?? "Unknown",
        score: matchDoc.data().score,
        relationship
      };
    })
  );

  return { items };
}

// ---------------------------------------------------------------------------
// Followed celebrities — api-contracts.md §5, data-model.md FollowedCelebrity,
// schema.md users/{uid}/followedCelebrities. Simpler than user-to-user Follow:
// one-directional, not mirrored (a Person doesn't follow back).
// ---------------------------------------------------------------------------

export async function followCelebrity(uid: string, personId: string): Promise<void> {
  const db = requireDb();
  const personSnap = await db.collection("people").doc(personId).get();
  if (!personSnap.exists) {
    throw new AppError("PERSON_NOT_FOUND", "No such person", 404);
  }
  await db.collection("users").doc(uid).collection("followedCelebrities").doc(personId).set({ followedAt: new Date() });
}

export async function unfollowCelebrity(uid: string, personId: string): Promise<void> {
  const db = requireDb();
  await db.collection("users").doc(uid).collection("followedCelebrities").doc(personId).delete();
}

export async function listFollowedCelebrities(uid: string) {
  const db = requireDb();
  const snap = await db.collection("users").doc(uid).collection("followedCelebrities").get();
  const items = await Promise.all(
    snap.docs.map(async (d) => {
      const personSnap = await db.collection("people").doc(d.id).get();
      return { personId: d.id, name: personSnap.data()?.name ?? "Unknown", photo: personSnap.data()?.photo ?? null };
    })
  );
  return { items, nextCursor: null };
}
