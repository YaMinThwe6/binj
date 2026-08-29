import { Router } from "express";
import { db } from "../lib/firebaseAdmin.js";
import { requireAuth } from "../middleware/auth.js";

export const userMoviesRouter = Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parseLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

async function movieExists(movieId: string): Promise<boolean> {
  const snap = await db!.collection("movies").doc(movieId).get();
  return snap.exists;
}

// Feeds Home's "Friends are watching" (routes/home.ts GET /home/activity). Fire-and-forget
// from the caller's perspective — never blocks or fails the watchlist/watched write itself.
async function writeActivity(uid: string, type: "watched" | "watchlist_added", movieId: string): Promise<void> {
  if (!db) return;
  await db.collection("activity").add({ uid, type, movieId, createdAt: new Date() });
}

function toIso(value: FirebaseFirestore.Timestamp | Date | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value.toDate().toISOString();
}

// ---------------------------------------------------------------------------
// Watchlist — api-contracts.md §2, hld.md §3, schema.md users/{uid}/watchlist
// ---------------------------------------------------------------------------

userMoviesRouter.put("/users/me/watchlist/:movieId", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const { movieId } = req.params;

  try {
    if (!(await movieExists(movieId))) {
      return res.status(404).json({ error: { code: "MOVIE_NOT_FOUND", message: "No such movie" } });
    }
    await db.collection("users").doc(req.uid!).collection("watchlist").doc(movieId).set({ addedAt: new Date() });
    await writeActivity(req.uid!, "watchlist_added", movieId);
    return res.status(204).send();
  } catch (err) {
    console.error(`[PUT /users/me/watchlist/${movieId}]`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to add to watchlist" } });
  }
});

userMoviesRouter.delete("/users/me/watchlist/:movieId", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const { movieId } = req.params;

  try {
    await db.collection("users").doc(req.uid!).collection("watchlist").doc(movieId).delete();
    return res.status(204).send();
  } catch (err) {
    console.error(`[DELETE /users/me/watchlist/${movieId}]`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to remove from watchlist" } });
  }
});

userMoviesRouter.get("/users/me/watchlist", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const limit = parseLimit(req.query.limit);
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;

  try {
    const col = db.collection("users").doc(req.uid!).collection("watchlist");
    let query = col.orderBy("addedAt", "desc").limit(limit);
    if (cursor) {
      const cursorSnap = await col.doc(cursor).get();
      if (cursorSnap.exists) query = query.startAfter(cursorSnap);
    }
    const snap = await query.get();
    const items = snap.docs.map((d) => ({ movieId: d.id, addedAt: toIso(d.data().addedAt) }));
    const nextCursor = snap.docs.length === limit ? snap.docs[snap.docs.length - 1].id : null;
    return res.json({ items, nextCursor });
  } catch (err) {
    console.error("[GET /users/me/watchlist]", err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to load watchlist" } });
  }
});

// ---------------------------------------------------------------------------
// Watched — api-contracts.md §2, hld.md §5a, schema.md users/{uid}/watched
// ---------------------------------------------------------------------------

userMoviesRouter.put("/users/me/watched/:movieId", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const { movieId } = req.params;
  const visibility = req.body?.visibility === "private" ? "private" : "public";
  const watchedAt = req.body?.watchedAt ? new Date(req.body.watchedAt) : new Date();

  try {
    if (!(await movieExists(movieId))) {
      return res.status(404).json({ error: { code: "MOVIE_NOT_FOUND", message: "No such movie" } });
    }
    await db.collection("users").doc(req.uid!).collection("watched").doc(movieId).set({ watchedAt, visibility });
    // hld.md §5a's per-entry privacy override applies here too — a private watched
    // entry must stay invisible to followers, not just to the general public.
    if (visibility === "public") {
      await writeActivity(req.uid!, "watched", movieId);
    }
    return res.status(204).send();
  } catch (err) {
    console.error(`[PUT /users/me/watched/${movieId}]`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to mark as watched" } });
  }
});

userMoviesRouter.delete("/users/me/watched/:movieId", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const { movieId } = req.params;

  try {
    await db.collection("users").doc(req.uid!).collection("watched").doc(movieId).delete();
    return res.status(204).send();
  } catch (err) {
    console.error(`[DELETE /users/me/watched/${movieId}]`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to remove from watched" } });
  }
});

userMoviesRouter.patch("/users/me/watched/:movieId", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const { movieId } = req.params;
  if (req.body?.visibility !== "public" && req.body?.visibility !== "private") {
    return res.status(400).json({ error: { code: "INVALID_VISIBILITY", message: "visibility must be 'public' or 'private'" } });
  }

  try {
    const ref = db.collection("users").doc(req.uid!).collection("watched").doc(movieId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: { code: "NOT_WATCHED", message: "This movie is not marked as watched" } });
    }
    await ref.update({ visibility: req.body.visibility });
    return res.status(204).send();
  } catch (err) {
    console.error(`[PATCH /users/me/watched/${movieId}]`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to update visibility" } });
  }
});

userMoviesRouter.get("/users/me/watched", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const limit = parseLimit(req.query.limit);
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;

  try {
    const col = db.collection("users").doc(req.uid!).collection("watched");
    let query = col.orderBy("watchedAt", "desc").limit(limit);
    if (cursor) {
      const cursorSnap = await col.doc(cursor).get();
      if (cursorSnap.exists) query = query.startAfter(cursorSnap);
    }
    const snap = await query.get();
    const items = snap.docs.map((d) => ({
      movieId: d.id,
      watchedAt: toIso(d.data().watchedAt),
      visibility: d.data().visibility
    }));
    const nextCursor = snap.docs.length === limit ? snap.docs[snap.docs.length - 1].id : null;
    return res.json({ items, nextCursor });
  } catch (err) {
    console.error("[GET /users/me/watched]", err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to load watched list" } });
  }
});

// ---------------------------------------------------------------------------
// Likes — api-contracts.md §2, data-model.md LikeEntry, schema.md users/{uid}/likes
// Toggle semantics: movies.likeCount is maintained transactionally, idempotent.
// ---------------------------------------------------------------------------

userMoviesRouter.put("/users/me/likes/:movieId", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const { movieId } = req.params;
  const likeRef = db.collection("users").doc(req.uid!).collection("likes").doc(movieId);
  const movieRef = db.collection("movies").doc(movieId);

  try {
    await db.runTransaction(async (tx) => {
      const [likeSnap, movieSnap] = await Promise.all([tx.get(likeRef), tx.get(movieRef)]);
      if (!movieSnap.exists) {
        throw Object.assign(new Error("MOVIE_NOT_FOUND"), { code: "MOVIE_NOT_FOUND" });
      }
      if (likeSnap.exists) return; // already liked — idempotent no-op
      tx.set(likeRef, { createdAt: new Date() });
      tx.update(movieRef, { likeCount: (movieSnap.data()?.likeCount ?? 0) + 1 });
    });
    return res.status(204).send();
  } catch (err) {
    if ((err as { code?: string }).code === "MOVIE_NOT_FOUND") {
      return res.status(404).json({ error: { code: "MOVIE_NOT_FOUND", message: "No such movie" } });
    }
    console.error(`[PUT /users/me/likes/${movieId}]`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to like movie" } });
  }
});

userMoviesRouter.delete("/users/me/likes/:movieId", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const { movieId } = req.params;
  const likeRef = db.collection("users").doc(req.uid!).collection("likes").doc(movieId);
  const movieRef = db.collection("movies").doc(movieId);

  try {
    await db.runTransaction(async (tx) => {
      const [likeSnap, movieSnap] = await Promise.all([tx.get(likeRef), tx.get(movieRef)]);
      if (!likeSnap.exists) return; // not liked — idempotent no-op
      tx.delete(likeRef);
      if (movieSnap.exists) {
        tx.update(movieRef, { likeCount: Math.max(0, (movieSnap.data()?.likeCount ?? 1) - 1) });
      }
    });
    return res.status(204).send();
  } catch (err) {
    console.error(`[DELETE /users/me/likes/${movieId}]`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to unlike movie" } });
  }
});
