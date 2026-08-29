import { Router } from "express";
import type { TasteMatch, CelebritySuggestion } from "@binj/shared-types";
import { db } from "../lib/firebaseAdmin.js";
import { requireAuth } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";

export const peopleRouter = Router();

// GET /users/me/tasteMatches — api-contracts.md §5, hld.md §5b.
// Read-only: precomputed by scripts/computeTasteMatches.ts (or the future
// cron+BigQuery pipeline it stands in for) — no write endpoint here.
peopleRouter.get("/users/me/tasteMatches", requireAuth, async (req, res) => {
  if (!db) {
    return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  }

  try {
    const snap = await db
      .collection("users")
      .doc(req.uid!)
      .collection("tasteMatches")
      .orderBy("score", "desc")
      .get();

    const items = await Promise.all(
      snap.docs.map(async (matchDoc): Promise<TasteMatch> => {
        const [userSnap, followingSnap, requestSnap] = await Promise.all([
          db!.collection("users").doc(matchDoc.id).get(),
          db!.collection("users").doc(req.uid!).collection("following").doc(matchDoc.id).get(),
          db!.collection("users").doc(matchDoc.id).collection("followRequests").doc(req.uid!).get()
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

    return res.json({ items });
  } catch (err) {
    logger.error(`[GET /users/me/tasteMatches] uid=${req.uid}`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to load taste matches" } });
  }
});

// ---------------------------------------------------------------------------
// Followed celebrities — api-contracts.md §5, data-model.md FollowedCelebrity,
// schema.md users/{uid}/followedCelebrities. Simpler than user-to-user Follow:
// one-directional, not mirrored (a Person doesn't follow back).
// ---------------------------------------------------------------------------

peopleRouter.put("/users/me/followedCelebrities/:personId", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const { personId } = req.params;

  try {
    const personSnap = await db.collection("people").doc(personId).get();
    if (!personSnap.exists) {
      return res.status(404).json({ error: { code: "PERSON_NOT_FOUND", message: "No such person" } });
    }
    await db.collection("users").doc(req.uid!).collection("followedCelebrities").doc(personId).set({ followedAt: new Date() });
    return res.status(204).send();
  } catch (err) {
    logger.error(`[PUT /users/me/followedCelebrities/${personId}]`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to follow celebrity" } });
  }
});

peopleRouter.delete("/users/me/followedCelebrities/:personId", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const { personId } = req.params;

  try {
    await db.collection("users").doc(req.uid!).collection("followedCelebrities").doc(personId).delete();
    return res.status(204).send();
  } catch (err) {
    logger.error(`[DELETE /users/me/followedCelebrities/${personId}]`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to unfollow celebrity" } });
  }
});

peopleRouter.get("/users/me/followedCelebrities", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });

  try {
    const snap = await db.collection("users").doc(req.uid!).collection("followedCelebrities").get();
    const items = await Promise.all(
      snap.docs.map(async (d) => {
        const personSnap = await db!.collection("people").doc(d.id).get();
        return { personId: d.id, name: personSnap.data()?.name ?? "Unknown", photo: personSnap.data()?.photo ?? null };
      })
    );
    return res.json({ items, nextCursor: null });
  } catch (err) {
    logger.error(`[GET /users/me/followedCelebrities] uid=${req.uid}`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to load followed celebrities" } });
  }
});

// GET /onboarding/celebrity-suggestions — api-contracts.md §5, hld.md §13.
// Ranks cast/crew from the caller's already-saved watched movies by how many of
// those movies they appear in, then by TMDB popularity. No fallback when watch
// history is empty — this onboarding step is skippable, unlike Watched's trending
// fallback which exists because that step isn't.
peopleRouter.get("/onboarding/celebrity-suggestions", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });

  try {
    const watchedSnap = await db.collection("users").doc(req.uid!).collection("watched").get();
    if (watchedSnap.docs.length === 0) {
      return res.json({ items: [] });
    }

    const movieSnaps = await Promise.all(watchedSnap.docs.map((d) => db!.collection("movies").doc(d.id).get()));

    const appearances = new Map<string, number>();
    const personInfo = new Map<string, { name: string; photo: string | null }>();
    for (const movieSnap of movieSnaps) {
      const credited = [...(movieSnap.data()?.cast ?? []), ...(movieSnap.data()?.crew ?? [])] as {
        personId: string;
        name: string;
        photo: string | null;
      }[];
      const uniquePersonIds = new Set(credited.map((c) => c.personId));
      for (const personId of uniquePersonIds) {
        appearances.set(personId, (appearances.get(personId) ?? 0) + 1);
        if (!personInfo.has(personId)) {
          const c = credited.find((x) => x.personId === personId)!;
          personInfo.set(personId, { name: c.name, photo: c.photo });
        }
      }
    }

    const ranked = [...appearances.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    const items: CelebritySuggestion[] = ranked.map(([personId, appearsIn]) => ({
      personId,
      name: personInfo.get(personId)!.name,
      photo: personInfo.get(personId)!.photo,
      appearsIn
    }));

    return res.json({ items });
  } catch (err) {
    logger.error(`[GET /onboarding/celebrity-suggestions] uid=${req.uid}`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to load celebrity suggestions" } });
  }
});
