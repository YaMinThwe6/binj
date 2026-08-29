import { Router } from "express";
import { db } from "../lib/firebaseAdmin.js";
import { requireAuth } from "../middleware/auth.js";
import { writeNotification } from "../lib/notify.js";
import { logger } from "../lib/logger.js";

export const followRouter = Router();

// PUT /users/:uid/follow — hld.md §4. Never trusts a frontend claim about which
// branch applies: always re-reads the target's CURRENT followRequiresApproval
// server-side. Idempotent in both branches (repeat clicks don't duplicate writes
// or spam notifications).
followRouter.put("/users/:uid/follow", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const targetUid = req.params.uid;
  const callerUid = req.uid!;

  if (targetUid === callerUid) {
    return res.status(400).json({ error: { code: "CANNOT_FOLLOW_SELF", message: "You can't follow yourself" } });
  }

  try {
    const targetRef = db.collection("users").doc(targetUid);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
      return res.status(404).json({ error: { code: "USER_NOT_FOUND", message: "No such user" } });
    }

    const followingRef = db.collection("users").doc(callerUid).collection("following").doc(targetUid);
    const alreadyFollowing = (await followingRef.get()).exists;
    if (alreadyFollowing) {
      return res.json({ status: "following" });
    }

    if (!targetSnap.data()?.followRequiresApproval) {
      const followersRef = db.collection("users").doc(targetUid).collection("followers").doc(callerUid);
      await db.batch().set(followingRef, { createdAt: new Date() }).set(followersRef, { createdAt: new Date() }).commit();
      return res.json({ status: "following" });
    }

    const requestRef = db.collection("users").doc(targetUid).collection("followRequests").doc(callerUid);
    const alreadyPending = (await requestRef.get()).exists;
    if (!alreadyPending) {
      await requestRef.set({ createdAt: new Date() });
      await writeNotification(targetUid, "followRequest", callerUid, "user", callerUid);
    }
    return res.json({ status: "pending" });
  } catch (err) {
    logger.error(`[PUT /users/${targetUid}/follow] caller=${callerUid}`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to follow user" } });
  }
});

// DELETE /users/:uid/follow — unfollows if following, cancels a pending request
// otherwise. Idempotent either way (hld.md §4's "Unfollow" sub-flow).
followRouter.delete("/users/:uid/follow", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const targetUid = req.params.uid;
  const callerUid = req.uid!;

  try {
    const followingRef = db.collection("users").doc(callerUid).collection("following").doc(targetUid);
    const followersRef = db.collection("users").doc(targetUid).collection("followers").doc(callerUid);
    const requestRef = db.collection("users").doc(targetUid).collection("followRequests").doc(callerUid);

    await db.batch().delete(followingRef).delete(followersRef).delete(requestRef).commit();
    return res.status(204).send();
  } catch (err) {
    logger.error(`[DELETE /users/${targetUid}/follow] caller=${callerUid}`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to unfollow user" } });
  }
});

// GET /users/me/followRequests — pending requests FOR the caller to approve/deny.
followRouter.get("/users/me/followRequests", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });

  try {
    const snap = await db.collection("users").doc(req.uid!).collection("followRequests").get();
    const items = await Promise.all(
      snap.docs.map(async (d) => {
        const userSnap = await db!.collection("users").doc(d.id).get();
        return {
          uid: d.id,
          displayName: userSnap.data()?.displayName ?? "Unknown",
          photoURL: userSnap.data()?.photoURL ?? null
        };
      })
    );
    return res.json({ items });
  } catch (err) {
    logger.error(`[GET /users/me/followRequests] uid=${req.uid}`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to load follow requests" } });
  }
});

followRouter.post("/users/me/followRequests/:requesterUid/approve", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const meUid = req.uid!;
  const requesterUid = req.params.requesterUid;

  try {
    const requestRef = db.collection("users").doc(meUid).collection("followRequests").doc(requesterUid);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
      return res.status(404).json({ error: { code: "REQUEST_NOT_FOUND", message: "No such follow request" } });
    }

    const followingRef = db.collection("users").doc(requesterUid).collection("following").doc(meUid);
    const followersRef = db.collection("users").doc(meUid).collection("followers").doc(requesterUid);
    await db.batch().set(followingRef, { createdAt: new Date() }).set(followersRef, { createdAt: new Date() }).delete(requestRef).commit();
    await writeNotification(requesterUid, "followApproved", meUid, "user", meUid);
    return res.status(204).send();
  } catch (err) {
    logger.error(`[POST /users/me/followRequests/${requesterUid}/approve] uid=${meUid}`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to approve follow request" } });
  }
});

followRouter.post("/users/me/followRequests/:requesterUid/deny", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const meUid = req.uid!;
  const requesterUid = req.params.requesterUid;

  try {
    await db.collection("users").doc(meUid).collection("followRequests").doc(requesterUid).delete();
    return res.status(204).send();
  } catch (err) {
    logger.error(`[POST /users/me/followRequests/${requesterUid}/deny] uid=${meUid}`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to deny follow request" } });
  }
});
