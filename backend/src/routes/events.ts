import { Router } from "express";
import { randomBytes } from "node:crypto";
import type { EventSummary, UpcomingEvent } from "@binj/shared-types";
import { db } from "../lib/firebaseAdmin.js";
import { requireAuth } from "../middleware/auth.js";
import { writeNotification } from "../lib/notify.js";

export const eventsRouter = Router();

const DEFAULT_UPCOMING_LIMIT = 10;
const MAX_UPCOMING_LIMIT = 50;

function generateJoinCode(): string {
  return randomBytes(4).toString("hex"); // 8 chars, e.g. "a1b2c3d4"
}

function toIso(value: FirebaseFirestore.Timestamp | Date | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value.toDate().toISOString();
}

function toEventSummary(id: string, data: FirebaseFirestore.DocumentData): EventSummary {
  return {
    eventId: id,
    hostId: data.hostId,
    movieId: data.movieId,
    title: data.title ?? null,
    datetime: toIso(data.datetime),
    mode: data.mode,
    location: data.location ?? null,
    visibility: data.visibility,
    joinCode: data.joinCode ?? null, // private events only — the host needs this back to share it (hld.md §7)
    participantLimit: data.participantLimit,
    participantCount: data.participantCount ?? 0,
    requiresApproval: data.requiresApproval,
    createdAt: toIso(data.createdAt)
  };
}

// POST /events — hld.md §7 "Create Event". Host auto-joins; every event gets a
// roomId (schema.md §4) so §16's chat feature has something real to attach to
// later, even though the chat UI itself isn't built yet.
eventsRouter.post("/events", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const hostId = req.uid!;
  const body = req.body ?? {};

  const { movieId, datetime, mode, visibility, participantLimit, requiresApproval } = body;
  if (
    typeof movieId !== "string" ||
    typeof datetime !== "string" ||
    (mode !== "online" && mode !== "in-person") ||
    (visibility !== "public" && visibility !== "private") ||
    typeof participantLimit !== "number" ||
    participantLimit < 1 ||
    typeof requiresApproval !== "boolean"
  ) {
    return res.status(400).json({
      error: {
        code: "INVALID_EVENT",
        message: "movieId, datetime, mode ('online'|'in-person'), visibility ('public'|'private'), participantLimit (>=1), requiresApproval are required"
      }
    });
  }
  const parsedDatetime = new Date(datetime);
  if (Number.isNaN(parsedDatetime.getTime())) {
    return res.status(400).json({ error: { code: "INVALID_EVENT", message: "datetime must be a valid date" } });
  }

  try {
    const movieSnap = await db.collection("movies").doc(movieId).get();
    if (!movieSnap.exists) {
      return res.status(404).json({ error: { code: "MOVIE_NOT_FOUND", message: "No such movie" } });
    }

    const eventRef = db.collection("events").doc();
    const roomRef = db.collection("rooms").doc();
    const participantRef = eventRef.collection("participants").doc(hostId);
    const now = new Date();

    const eventDoc = {
      hostId,
      movieId,
      title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : null,
      datetime: parsedDatetime,
      mode,
      location: body.location ?? null,
      geohash: null, // §9 location-based discovery — not computed yet, not needed for Home
      visibility,
      participantLimit,
      participantCount: 1, // host auto-joins
      requiresApproval,
      joinCode: visibility === "private" ? generateJoinCode() : null,
      invitedUserIds: Array.isArray(body.invitedUserIds) ? body.invitedUserIds : null,
      roomId: roomRef.id,
      createdAt: now
    };

    const batch = db.batch();
    batch.set(eventRef, eventDoc);
    batch.set(participantRef, { joinedAt: now });
    batch.set(roomRef, { type: "persistent", originEventId: eventRef.id, memberIds: [hostId], createdAt: now });
    await batch.commit();

    return res.status(201).json(toEventSummary(eventRef.id, eventDoc));
  } catch (err) {
    console.error(`[POST /events] hostId=${hostId}`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to create event" } });
  }
});

// GET /events/upcoming — public events browse/upcoming list (schema.md §6's
// documented-but-not-yet-flowed index: visibility asc + datetime asc). Powers
// Home's "Upcoming watch events" section.
eventsRouter.get("/events/upcoming", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_UPCOMING_LIMIT) : DEFAULT_UPCOMING_LIMIT;

  try {
    const snap = await db
      .collection("events")
      .where("visibility", "==", "public")
      .where("datetime", ">=", new Date())
      .orderBy("datetime", "asc")
      .limit(limit)
      .get();

    const items: UpcomingEvent[] = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();
        const movieSnap = await db!.collection("movies").doc(data.movieId).get();
        return {
          ...toEventSummary(d.id, data),
          movieTitle: movieSnap.data()?.title ?? null,
          moviePoster: movieSnap.data()?.poster ?? null
        };
      })
    );

    return res.json({ items });
  } catch (err) {
    console.error("[GET /events/upcoming]", err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to load upcoming events" } });
  }
});

// PUT /events/:eventId/join — hld.md §7 "Join Event". Branches on the event's own
// settings, re-checked server-side every time — never trusts a frontend claim.
eventsRouter.put("/events/:eventId/join", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const { eventId } = req.params;
  const uid = req.uid!;
  const eventRef = db.collection("events").doc(eventId);

  try {
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      return res.status(404).json({ error: { code: "EVENT_NOT_FOUND", message: "No such event" } });
    }
    const event = eventSnap.data()!;
    const participantRef = eventRef.collection("participants").doc(uid);
    if ((await participantRef.get()).exists) {
      return res.json({ status: "joined" });
    }

    if (!event.requiresApproval) {
      const result = await db.runTransaction(async (tx) => {
        const freshEvent = await tx.get(eventRef);
        const count = (freshEvent.data()?.participantCount as number) ?? 0;
        if (count >= (freshEvent.data()?.participantLimit as number)) {
          return "full" as const;
        }
        tx.set(participantRef, { joinedAt: new Date() });
        tx.update(eventRef, { participantCount: count + 1 });
        return "joined" as const;
      });
      if (result === "full") {
        return res.status(409).json({ error: { code: "EVENT_FULL", message: "This event is at capacity" } });
      }
      return res.json({ status: "joined" });
    }

    const requestRef = eventRef.collection("joinRequests").doc(uid);
    if (!(await requestRef.get()).exists) {
      await requestRef.set({ createdAt: new Date() });
      await writeNotification(event.hostId, "eventJoinRequest", uid, "event", eventId);
    }
    return res.json({ status: "pending" });
  } catch (err) {
    console.error(`[PUT /events/${eventId}/join] uid=${uid}`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to join event" } });
  }
});

// DELETE /events/:eventId/join — leave the event, or cancel a pending request.
eventsRouter.delete("/events/:eventId/join", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const { eventId } = req.params;
  const uid = req.uid!;
  const eventRef = db.collection("events").doc(eventId);
  const participantRef = eventRef.collection("participants").doc(uid);
  const requestRef = eventRef.collection("joinRequests").doc(uid);

  try {
    await db.runTransaction(async (tx) => {
      const [participantSnap, eventSnap] = await Promise.all([tx.get(participantRef), tx.get(eventRef)]);
      if (participantSnap.exists) {
        tx.delete(participantRef);
        if (eventSnap.exists) {
          const count = (eventSnap.data()?.participantCount as number) ?? 1;
          tx.update(eventRef, { participantCount: Math.max(0, count - 1) });
        }
      }
      tx.delete(requestRef);
    });
    return res.status(204).send();
  } catch (err) {
    console.error(`[DELETE /events/${eventId}/join] uid=${uid}`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to leave event" } });
  }
});

// GET /events/:eventId/joinRequests — host-only (hld.md §7's reused §3 ownership check).
eventsRouter.get("/events/:eventId/joinRequests", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const { eventId } = req.params;
  const uid = req.uid!;

  try {
    const eventSnap = await db.collection("events").doc(eventId).get();
    if (!eventSnap.exists) {
      return res.status(404).json({ error: { code: "EVENT_NOT_FOUND", message: "No such event" } });
    }
    if (eventSnap.data()?.hostId !== uid) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the host can view join requests" } });
    }

    const snap = await db.collection("events").doc(eventId).collection("joinRequests").get();
    const items = await Promise.all(
      snap.docs.map(async (d) => {
        const userSnap = await db!.collection("users").doc(d.id).get();
        return { uid: d.id, displayName: userSnap.data()?.displayName ?? "Unknown" };
      })
    );
    return res.json({ items });
  } catch (err) {
    console.error(`[GET /events/${eventId}/joinRequests] uid=${uid}`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to load join requests" } });
  }
});

eventsRouter.post("/events/:eventId/joinRequests/:requesterUid/approve", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const { eventId, requesterUid } = req.params;
  const uid = req.uid!;
  const eventRef = db.collection("events").doc(eventId);

  try {
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) {
      return res.status(404).json({ error: { code: "EVENT_NOT_FOUND", message: "No such event" } });
    }
    if (eventSnap.data()?.hostId !== uid) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the host can approve join requests" } });
    }

    const requestRef = eventRef.collection("joinRequests").doc(requesterUid);
    const result = await db.runTransaction(async (tx) => {
      const [requestSnap, freshEvent] = await Promise.all([tx.get(requestRef), tx.get(eventRef)]);
      if (!requestSnap.exists) return "not_found" as const;
      const count = (freshEvent.data()?.participantCount as number) ?? 0;
      if (count >= (freshEvent.data()?.participantLimit as number)) return "full" as const;
      tx.set(eventRef.collection("participants").doc(requesterUid), { joinedAt: new Date() });
      tx.update(eventRef, { participantCount: count + 1 });
      tx.delete(requestRef);
      return "approved" as const;
    });

    if (result === "not_found") {
      return res.status(404).json({ error: { code: "REQUEST_NOT_FOUND", message: "No such join request" } });
    }
    if (result === "full") {
      return res.status(409).json({ error: { code: "EVENT_FULL", message: "This event is at capacity" } });
    }
    await writeNotification(requesterUid, "eventJoinApproved", uid, "event", eventId);
    return res.status(204).send();
  } catch (err) {
    console.error(`[POST /events/${eventId}/joinRequests/${requesterUid}/approve] uid=${uid}`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to approve join request" } });
  }
});

eventsRouter.post("/events/:eventId/joinRequests/:requesterUid/deny", requireAuth, async (req, res) => {
  if (!db) return res.status(503).json({ error: { code: "FIRESTORE_NOT_CONFIGURED", message: "Firestore is not configured" } });
  const { eventId, requesterUid } = req.params;
  const uid = req.uid!;

  try {
    const eventSnap = await db.collection("events").doc(eventId).get();
    if (!eventSnap.exists) {
      return res.status(404).json({ error: { code: "EVENT_NOT_FOUND", message: "No such event" } });
    }
    if (eventSnap.data()?.hostId !== uid) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the host can deny join requests" } });
    }
    await db.collection("events").doc(eventId).collection("joinRequests").doc(requesterUid).delete();
    return res.status(204).send();
  } catch (err) {
    console.error(`[POST /events/${eventId}/joinRequests/${requesterUid}/deny] uid=${uid}`, err);
    return res.status(502).json({ error: { code: "FIRESTORE_ERROR", message: "Failed to deny join request" } });
  }
});
