import { Router } from "express";
import type { NotificationItem } from "@binj/shared-types";
import { db } from "../lib/firebaseAdmin.js";
import { requireAuth } from "../middleware/auth.js";

export const notificationsRouter = Router();

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

// GET /users/me/notifications — schema.md §5, §6 composite index (read asc + createdAt desc).
// Powers the bell badge on Home's top bar (hld.md §17's read/notification flow — full
// notification-center UI is a separate later item; this is just the read surface).
notificationsRouter.get("/users/me/notifications", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });

  const limit = parseLimit(req.query.limit);
  const unreadOnly = req.query.unreadOnly === "true";

  try {
    const col = db.collection("users").doc(req.uid!).collection("notifications");
    let query: FirebaseFirestore.Query = col;
    if (unreadOnly) query = query.where("read", "==", false);
    query = query.orderBy("createdAt", "desc").limit(limit);

    const snap = await query.get();
    const items: NotificationItem[] = snap.docs.map((d) => ({
      id: d.id,
      type: d.data().type,
      fromUserId: d.data().fromUserId ?? null,
      targetType: d.data().targetType ?? null,
      targetId: d.data().targetId ?? null,
      read: d.data().read,
      createdAt: toIso(d.data().createdAt)
    }));

    return res.json({ items });
  } catch (err) {
    console.error(`[GET /users/me/notifications] uid=${req.uid}`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to load notifications" } });
  }
});

notificationsRouter.patch("/users/me/notifications/:notificationId", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const { notificationId } = req.params;
  if (req.body?.read !== true) {
    return res.status(400).json({ error: { code: "INVALID_BODY", message: "Only { read: true } is supported" } });
  }

  try {
    const ref = db.collection("users").doc(req.uid!).collection("notifications").doc(notificationId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: { code: "NOTIFICATION_NOT_FOUND", message: "No such notification" } });
    }
    await ref.update({ read: true });
    return res.status(204).send();
  } catch (err) {
    console.error(`[PATCH /users/me/notifications/${notificationId}]`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to update notification" } });
  }
});
