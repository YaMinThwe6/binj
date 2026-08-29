import { randomBytes } from "node:crypto";
import type { EventSummary, UpcomingEvent, NearbyEvent } from "@binj/shared-types";
import { requireDb } from "../lib/firebaseAdmin.js";
import { writeNotification } from "../lib/notify.js";
import { AppError } from "../utils/AppError.js";
import { encodeGeohash, geohashPrecisionForRadiusKm, geohashPrefixRange, haversineDistanceKm } from "../lib/geohash.js";

const GEOHASH_STORAGE_PRECISION = 9;
const MAX_NEARBY_RADIUS_KM = 200;

const DEFAULT_UPCOMING_LIMIT = 10;
const MAX_UPCOMING_LIMIT = 50;

function generateJoinCode(): string {
  return randomBytes(4).toString("hex"); // 8 chars, e.g. "a1b2c3d4"
}

function toIso(value: FirebaseFirestore.Timestamp | Date | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value.toDate().toISOString();
}

function isValidLatLng(location: unknown): location is { lat: number; lng: number } {
  if (typeof location !== "object" || location === null) return false;
  const { lat, lng } = location as { lat?: unknown; lng?: unknown };
  return typeof lat === "number" && typeof lng === "number" && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
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

export interface CreateEventInput {
  movieId?: unknown;
  datetime?: unknown;
  mode?: unknown;
  visibility?: unknown;
  participantLimit?: unknown;
  requiresApproval?: unknown;
  title?: unknown;
  location?: unknown;
  invitedUserIds?: unknown;
}

// POST /events — hld.md §7 "Create Event". Host auto-joins; every event gets a
// roomId (schema.md §4) so §16's chat feature has something real to attach to
// later, even though the chat UI itself isn't built yet.
export async function createEvent(hostId: string, body: CreateEventInput): Promise<EventSummary> {
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
    throw new AppError(
      "INVALID_EVENT",
      "movieId, datetime, mode ('online'|'in-person'), visibility ('public'|'private'), participantLimit (>=1), requiresApproval are required",
      400
    );
  }
  const parsedDatetime = new Date(datetime);
  if (Number.isNaN(parsedDatetime.getTime())) {
    throw new AppError("INVALID_EVENT", "datetime must be a valid date", 400);
  }

  const db = requireDb();
  const movieSnap = await db.collection("movies").doc(movieId).get();
  if (!movieSnap.exists) {
    throw new AppError("MOVIE_NOT_FOUND", "No such movie", 404);
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
    // hld.md §9 — geohash powers /events/nearby's prefix-range query. Only
    // meaningful for in-person events with a real lat/lng; online events (and
    // in-person events without a resolved location yet) simply aren't
    // discoverable by location, same as they're already absent from any
    // radius search a client might run.
    geohash: isValidLatLng(body.location) ? encodeGeohash(body.location.lat, body.location.lng, GEOHASH_STORAGE_PRECISION) : null,
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

  return toEventSummary(eventRef.id, eventDoc);
}

// GET /events/upcoming — public events browse/upcoming list (schema.md §6's
// documented-but-not-yet-flowed index: visibility asc + datetime asc). Powers
// Home's "Upcoming watch events" section.
export async function listUpcomingEvents(rawLimit: unknown): Promise<{ items: UpcomingEvent[] }> {
  const db = requireDb();
  const parsedLimit = Number(rawLimit);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, MAX_UPCOMING_LIMIT) : DEFAULT_UPCOMING_LIMIT;

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
      const movieSnap = await db.collection("movies").doc(data.movieId).get();
      return {
        ...toEventSummary(d.id, data),
        movieTitle: movieSnap.data()?.title ?? null,
        moviePoster: movieSnap.data()?.poster ?? null
      };
    })
  );

  return { items };
}

// PUT /events/:eventId/join — hld.md §7 "Join Event". Branches on the event's own
// settings, re-checked server-side every time — never trusts a frontend claim.
export async function joinEvent(uid: string, eventId: string): Promise<{ status: "joined" | "pending" }> {
  const db = requireDb();
  const eventRef = db.collection("events").doc(eventId);

  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) {
    throw new AppError("EVENT_NOT_FOUND", "No such event", 404);
  }
  const event = eventSnap.data()!;
  const participantRef = eventRef.collection("participants").doc(uid);
  if ((await participantRef.get()).exists) {
    return { status: "joined" };
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
      throw new AppError("EVENT_FULL", "This event is at capacity", 409);
    }
    return { status: "joined" };
  }

  const requestRef = eventRef.collection("joinRequests").doc(uid);
  if (!(await requestRef.get()).exists) {
    await requestRef.set({ createdAt: new Date() });
    await writeNotification(event.hostId, "eventJoinRequest", uid, "event", eventId);
  }
  return { status: "pending" };
}

// DELETE /events/:eventId/join — leave the event, or cancel a pending request.
export async function leaveEvent(uid: string, eventId: string): Promise<void> {
  const db = requireDb();
  const eventRef = db.collection("events").doc(eventId);
  const participantRef = eventRef.collection("participants").doc(uid);
  const requestRef = eventRef.collection("joinRequests").doc(uid);

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
}

// GET /events/:eventId/joinRequests — host-only (hld.md §7's reused §3 ownership check).
export async function listJoinRequests(uid: string, eventId: string) {
  const db = requireDb();
  const eventSnap = await db.collection("events").doc(eventId).get();
  if (!eventSnap.exists) {
    throw new AppError("EVENT_NOT_FOUND", "No such event", 404);
  }
  if (eventSnap.data()?.hostId !== uid) {
    throw new AppError("FORBIDDEN", "Only the host can view join requests", 403);
  }

  const snap = await db.collection("events").doc(eventId).collection("joinRequests").get();
  const items = await Promise.all(
    snap.docs.map(async (d) => {
      const userSnap = await db.collection("users").doc(d.id).get();
      return { uid: d.id, displayName: userSnap.data()?.displayName ?? "Unknown" };
    })
  );
  return { items };
}

export async function approveJoinRequest(uid: string, eventId: string, requesterUid: string): Promise<void> {
  const db = requireDb();
  const eventRef = db.collection("events").doc(eventId);

  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) {
    throw new AppError("EVENT_NOT_FOUND", "No such event", 404);
  }
  if (eventSnap.data()?.hostId !== uid) {
    throw new AppError("FORBIDDEN", "Only the host can approve join requests", 403);
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
    throw new AppError("REQUEST_NOT_FOUND", "No such join request", 404);
  }
  if (result === "full") {
    throw new AppError("EVENT_FULL", "This event is at capacity", 409);
  }
  await writeNotification(requesterUid, "eventJoinApproved", uid, "event", eventId);
}

export async function denyJoinRequest(uid: string, eventId: string, requesterUid: string): Promise<void> {
  const db = requireDb();
  const eventSnap = await db.collection("events").doc(eventId).get();
  if (!eventSnap.exists) {
    throw new AppError("EVENT_NOT_FOUND", "No such event", 404);
  }
  if (eventSnap.data()?.hostId !== uid) {
    throw new AppError("FORBIDDEN", "Only the host can deny join requests", 403);
  }
  await db.collection("events").doc(eventId).collection("joinRequests").doc(requesterUid).delete();
}

// GET /events/nearby — hld.md §9. Firestore has no native radius query, so
// this runs a geohash-prefix range query (an approximation of a bounding
// box), then post-filters to an actual haversine distance and sorts by it.
// Composes with §7's existing visibility rules rather than bypassing them —
// a naive geo-radius query would otherwise leak a private event's
// existence/location to any nearby stranger: results are limited to public
// events, or private events the caller is hosting or was explicitly invited
// to. (A join-code holder who isn't invited can still open that event
// directly by ID — this endpoint just doesn't surface it via location.)
export async function listNearbyEvents(callerUid: string, rawLat: unknown, rawLng: unknown, rawRadiusKm: unknown): Promise<{ items: NearbyEvent[] }> {
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  const radiusKm = Number(rawRadiusKm);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new AppError("INVALID_QUERY", "lat/lng must be valid coordinates", 400);
  }
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > MAX_NEARBY_RADIUS_KM) {
    throw new AppError("INVALID_QUERY", `radiusKm must be a positive number up to ${MAX_NEARBY_RADIUS_KM}`, 400);
  }

  const db = requireDb();
  const precision = geohashPrecisionForRadiusKm(radiusKm);
  const prefix = encodeGeohash(lat, lng, precision);
  const { start, end } = geohashPrefixRange(prefix);

  const snap = await db.collection("events").where("geohash", ">=", start).where("geohash", "<", end).get();

  const candidates = snap.docs
    .map((d) => ({ id: d.id, data: d.data() }))
    .filter(({ data }) => {
      if (data.visibility === "public") return true;
      return data.hostId === callerUid || (Array.isArray(data.invitedUserIds) && data.invitedUserIds.includes(callerUid));
    })
    .filter(({ data }) => isValidLatLng(data.location))
    .map(({ id, data }) => ({
      id,
      data,
      distanceKm: haversineDistanceKm(lat, lng, data.location.lat, data.location.lng)
    }))
    .filter(({ distanceKm }) => distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const items: NearbyEvent[] = await Promise.all(
    candidates.map(async ({ id, data, distanceKm }) => {
      const movieSnap = await db.collection("movies").doc(data.movieId).get();
      return {
        ...toEventSummary(id, data),
        movieTitle: movieSnap.data()?.title ?? null,
        moviePoster: movieSnap.data()?.poster ?? null,
        distanceKm: Math.round(distanceKm * 10) / 10
      };
    })
  );

  return { items };
}
