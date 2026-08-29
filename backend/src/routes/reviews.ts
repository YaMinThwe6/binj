import { Router } from "express";
import type { Review } from "@binj/shared-types";
import { db } from "../lib/firebaseAdmin.js";
import { requireAuth } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";

export const reviewsRouter = Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parseLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function toIso(value: FirebaseFirestore.Timestamp | Date | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value.toDate().toISOString();
}

// PUT /movies/:movieId/reviews/me — hld.md §20. Submit and edit are the same
// operation: the review doc is keyed by the caller's own uid, so writing to
// it either creates it (first time) or overwrites it (editing) — no separate
// create-vs-update branch, no "find my existing review" query.
reviewsRouter.put("/movies/:movieId/reviews/me", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const { movieId } = req.params;
  const uid = req.uid!;
  const body = req.body ?? {};

  const rating = body.rating;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: { code: "INVALID_RATING", message: "rating must be an integer from 1 to 5" } });
  }
  if (typeof body.isAnonymous !== "boolean") {
    return res.status(400).json({ error: { code: "INVALID_BODY", message: "isAnonymous (boolean) is required" } });
  }
  const reviewText: string | null = typeof body.reviewText === "string" ? body.reviewText : null;

  try {
    const movieRef = db.collection("movies").doc(movieId);
    const movieSnap = await movieRef.get();
    if (!movieSnap.exists) {
      return res.status(404).json({ error: { code: "MOVIE_NOT_FOUND", message: "No such movie" } });
    }

    const userSnap = await db.collection("users").doc(uid).get();
    if (userSnap.data()?.status && userSnap.data()?.status !== "active") {
      return res.status(403).json({ error: { code: "ACCOUNT_RESTRICTED", message: "Your account can't post reviews right now" } });
    }

    const reviewRef = movieRef.collection("reviews").doc(uid);
    const now = new Date();

    const result = await db.runTransaction(async (tx) => {
      const [reviewSnap, freshMovieSnap] = await Promise.all([tx.get(reviewRef), tx.get(movieRef)]);
      const existing = reviewSnap.exists ? (reviewSnap.data() as { rating: number; deleted: boolean; createdAt: unknown }) : null;
      const isFirstTime = !existing || existing.deleted;

      const currentAggregate = (freshMovieSnap.data()?.binjRating as { sum: number; count: number } | undefined) ?? { sum: 0, count: 0 };
      const newAggregate = isFirstTime
        ? { sum: currentAggregate.sum + rating, count: currentAggregate.count + 1 }
        : { sum: currentAggregate.sum + (rating - existing!.rating), count: currentAggregate.count };

      const createdAt = isFirstTime ? now : existing!.createdAt;
      tx.set(reviewRef, {
        rating,
        reviewText,
        isAnonymous: body.isAnonymous,
        deleted: false,
        modRemovalCount: isFirstTime ? 0 : (reviewSnap.data()?.modRemovalCount ?? 0),
        createdAt,
        updatedAt: now
      });
      tx.update(movieRef, { binjRating: newAggregate });

      return { createdAt, updatedAt: now };
    });

    return res.json({
      rating,
      reviewText,
      isAnonymous: body.isAnonymous,
      createdAt: toIso(result.createdAt as Date),
      updatedAt: toIso(result.updatedAt)
    });
  } catch (err) {
    logger.error(`[PUT /movies/${movieId}/reviews/me] uid=${uid}`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to save review" } });
  }
});

// DELETE /movies/:movieId/reviews/me — hld.md §21: soft delete, reverses the
// review's contribution to the movie's aggregate rating.
reviewsRouter.delete("/movies/:movieId/reviews/me", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const { movieId } = req.params;
  const uid = req.uid!;
  const movieRef = db.collection("movies").doc(movieId);
  const reviewRef = movieRef.collection("reviews").doc(uid);

  try {
    const result = await db.runTransaction(async (tx) => {
      const [reviewSnap, movieSnap] = await Promise.all([tx.get(reviewRef), tx.get(movieRef)]);
      if (!reviewSnap.exists || reviewSnap.data()?.deleted) {
        return "not_found" as const;
      }
      const rating = reviewSnap.data()?.rating as number;
      const currentAggregate = (movieSnap.data()?.binjRating as { sum: number; count: number } | undefined) ?? { sum: 0, count: 0 };
      tx.update(movieRef, {
        binjRating: { sum: Math.max(0, currentAggregate.sum - rating), count: Math.max(0, currentAggregate.count - 1) }
      });
      tx.update(reviewRef, { deleted: true, updatedAt: new Date() });
      return "deleted" as const;
    });

    if (result === "not_found") {
      return res.status(404).json({ error: { code: "REVIEW_NOT_FOUND", message: "You haven't reviewed this movie" } });
    }
    return res.status(204).send();
  } catch (err) {
    logger.error(`[DELETE /movies/${movieId}/reviews/me] uid=${uid}`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to delete review" } });
  }
});

// GET /movies/:movieId/reviews — public list, api-contracts.md §3. Anonymous
// reviews are redacted server-side (authorId/displayName: null) — never trust
// the client to hide this once it already has the data.
reviewsRouter.get("/movies/:movieId/reviews", async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const { movieId } = req.params;
  const limit = parseLimit(req.query.limit);
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;

  try {
    const col = db.collection("movies").doc(movieId).collection("reviews");
    let query: FirebaseFirestore.Query = col.where("deleted", "==", false).orderBy("createdAt", "desc").limit(limit);
    if (cursor) {
      const cursorSnap = await col.doc(cursor).get();
      if (cursorSnap.exists) query = query.startAfter(cursorSnap);
    }

    const snap = await query.get();
    const items: Review[] = await Promise.all(
      snap.docs.map(async (d): Promise<Review> => {
        const data = d.data();
        const isAnonymous = Boolean(data.isAnonymous);
        let displayName: string | null = null;
        if (!isAnonymous) {
          const userSnap = await db!.collection("users").doc(d.id).get();
          displayName = userSnap.data()?.displayName ?? "Unknown";
        }
        return {
          authorId: isAnonymous ? null : d.id,
          displayName,
          rating: data.rating,
          reviewText: data.reviewText ?? null,
          isAnonymous,
          createdAt: toIso(data.createdAt),
          updatedAt: toIso(data.updatedAt)
        };
      })
    );
    const nextCursor = snap.docs.length === limit ? snap.docs[snap.docs.length - 1].id : null;

    return res.json({ items, nextCursor });
  } catch (err) {
    logger.error(`[GET /movies/${movieId}/reviews]`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to load reviews" } });
  }
});
