import type { TasteMatch, WatchedByEntry, PersonSummary } from "@binj/shared-types";
import { requireDb } from "../lib/firebaseAdmin.js";
import { AppError } from "../utils/AppError.js";
import { significantWords } from "../lib/searchIndex.js";
import { rankCandidate } from "../lib/searchRanking.js";

const MAX_QUERY_WORDS = 30; // Firestore's array-contains-any cap — same as movies.service.ts's search
const RESULTS_TOP_N = 20;

function toIso(value: FirebaseFirestore.Timestamp | Date | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value.toDate().toISOString();
}

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

// GET /people/search — by-name lookup over the local people/{personId}
// catalog (populated lazily from movie credits, movies.service.ts's person
// upsert — schema.md's "every credited person, not just top-billed").
// Local-only, unlike movie search: there's no equivalent live "search
// people directly" TMDB call already wired into this codebase the way
// TMDB's movie search is, so this only ever finds someone BINJ has already
// ingested via some movie's credits — not the entire universe of actors.
export async function searchPeopleService(rawQuery: unknown): Promise<{ items: PersonSummary[] }> {
  const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
  if (!query) {
    throw new AppError("MISSING_QUERY", "q query param is required", 400);
  }

  const db = requireDb();
  const queryWords = significantWords(query).slice(0, MAX_QUERY_WORDS);
  if (queryWords.length === 0) {
    return { items: [] };
  }

  const snap = await db.collection("people").where("nameSearchTerms", "array-contains-any", queryWords).get();

  const items: PersonSummary[] = snap.docs
    .map((d) => ({ id: d.id, data: d.data() }))
    .map(({ id, data }) => ({
      id,
      name: data.name as string,
      photo: (data.photo as string | null) ?? null,
      ...rankCandidate(query, { title: data.name as string, popularitySignal: data.popularity as number | undefined })
    }))
    .filter((r) => r.matchType !== "none")
    .sort((a, b) => b.score - a.score)
    .slice(0, RESULTS_TOP_N)
    .map(({ id, name, photo }) => ({ personId: id, name, photo }));

  return { items };
}

// GET /movies/:movieId/watchedBy — hld.md §5a, api-contracts.md §5. Never a
// global "everyone who watched this" list — fans out from the caller's own
// (bounded) `following` list and checks each one directly, so cost scales
// with how many people the caller follows, not with BINJ's whole user base.
//
// Two independent privacy checks per followed user, both must pass:
//   - list-level: users/{uid}.listVisible
//   - per-entry override: users/{uid}/watched/{movieId}.visibility !== "private"
const MAX_FOLLOWING_FOR_WATCHED_BY = 30; // safety bound on the fan-out width, not a Firestore query-operator limit here
export async function getMovieWatchedBy(callerUid: string, movieId: string): Promise<{ items: WatchedByEntry[]; nextCursor: null }> {
  const db = requireDb();
  const followingSnap = await db.collection("users").doc(callerUid).collection("following").get();
  const followedUids = followingSnap.docs.map((d) => d.id).slice(0, MAX_FOLLOWING_FOR_WATCHED_BY);

  const results = await Promise.all(
    followedUids.map(async (uid): Promise<WatchedByEntry | null> => {
      const [userSnap, watchedSnap] = await Promise.all([
        db.collection("users").doc(uid).get(),
        db.collection("users").doc(uid).collection("watched").doc(movieId).get()
      ]);
      if (!watchedSnap.exists) return null;
      if (userSnap.data()?.listVisible !== true) return null;
      if (watchedSnap.data()?.visibility === "private") return null;

      return {
        uid,
        displayName: userSnap.data()?.displayName ?? "Unknown",
        watchedAt: toIso(watchedSnap.data()?.watchedAt ?? null)
      };
    })
  );

  return { items: results.filter((r): r is WatchedByEntry => r !== null), nextCursor: null };
}
