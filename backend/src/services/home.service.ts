import type { Greeting, ActivityItem } from "@binj/shared-types";
import { requireDb } from "../lib/firebaseAdmin.js";
import { pickQuoteForMovieIds, pickRandomQuote } from "../data/movieQuotes.js";

const MAX_FOLLOWING_FOR_FEED = 30; // Firestore "in" query cap
const DEFAULT_ACTIVITY_LIMIT = 12;

function toIso(value: FirebaseFirestore.Timestamp | Date | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value.toDate().toISOString();
}

// GET /home/greeting — hld.md §6/§13's movie-dialogue greeting. Prefers a quote
// from a movie the caller has actually watched (this is what makes a brand-new
// user's very first Home visit already feel personalized, per §13's note); falls
// back to a random pick from the full curated pool otherwise.
export async function getGreeting(uid: string): Promise<Greeting> {
  const db = requireDb();
  const watchedSnap = await db.collection("users").doc(uid).collection("watched").get();
  const watchedIds = watchedSnap.docs.map((d) => d.id);
  const matched = pickQuoteForMovieIds(watchedIds);
  const picked = matched ?? pickRandomQuote();

  return {
    quote: picked.quote,
    attribution: picked.attribution,
    source: matched ? "watched" : "random"
  };
}

// GET /home/activity — "Friends are watching". Fans out from the caller's own
// (bounded) following list, same shape as §5a's "people who watched this movie" —
// never a global feed, only people the caller actually follows. Reviews/ratings
// don't exist yet, so activity types are currently limited to what real write
// paths produce: "watched" and "watchlist_added" (written in userMovies.ts).
export async function getActivity(uid: string): Promise<{ items: ActivityItem[] }> {
  const db = requireDb();
  const followingSnap = await db.collection("users").doc(uid).collection("following").get();
  const followingIds = followingSnap.docs.map((d) => d.id).slice(0, MAX_FOLLOWING_FOR_FEED);

  if (followingIds.length === 0) {
    return { items: [] };
  }

  const snap = await db
    .collection("activity")
    .where("uid", "in", followingIds)
    .orderBy("createdAt", "desc")
    .limit(DEFAULT_ACTIVITY_LIMIT)
    .get();

  const items: ActivityItem[] = await Promise.all(
    snap.docs.map(async (d): Promise<ActivityItem> => {
      const data = d.data();
      const [userSnap, movieSnap] = await Promise.all([
        db.collection("users").doc(data.uid).get(),
        db.collection("movies").doc(data.movieId).get()
      ]);
      return {
        activityId: d.id,
        uid: data.uid,
        displayName: userSnap.data()?.displayName ?? "Unknown",
        type: data.type,
        movieId: data.movieId,
        movieTitle: movieSnap.data()?.title ?? null,
        moviePoster: movieSnap.data()?.poster ?? null,
        createdAt: toIso(data.createdAt)
      };
    })
  );

  return { items };
}
