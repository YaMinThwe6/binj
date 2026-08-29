import type { CreateReportResult } from "@binj/shared-types";
import { requireDb } from "../lib/firebaseAdmin.js";
import { writeNotification } from "../lib/notify.js";
import { AppError } from "../utils/AppError.js";
import { geminiConfigured, moderateContent, type ModerationDecision } from "../lib/gemini.js";

const VALID_TARGET_TYPES = ["message", "review", "user", "event"] as const;
type TargetType = (typeof VALID_TARGET_TYPES)[number];

export interface CreateReportInput {
  targetType?: unknown;
  targetId?: unknown;
  reason?: unknown;
  roomId?: unknown; // required for targetType "message"
  movieId?: unknown; // required for targetType "review"
}

interface ResolvedTarget {
  ref: FirebaseFirestore.DocumentReference;
  content: string;
  authorUid: string;
}

function toIso(value: FirebaseFirestore.Timestamp | Date | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value.toDate().toISOString();
}

async function resolveTarget(db: FirebaseFirestore.Firestore, targetType: TargetType, targetId: string, body: CreateReportInput): Promise<ResolvedTarget> {
  if (targetType === "message") {
    const roomId = body.roomId;
    if (typeof roomId !== "string" || !roomId) {
      throw new AppError("INVALID_REPORT", "roomId is required when reporting a message", 400);
    }
    const ref = db.collection("rooms").doc(roomId).collection("messages").doc(targetId);
    const snap = await ref.get();
    if (!snap.exists) throw new AppError("TARGET_NOT_FOUND", "No such message", 404);
    return { ref, content: (snap.data()?.text as string) ?? "", authorUid: snap.data()?.authorId as string };
  }

  if (targetType === "review") {
    const movieId = body.movieId;
    if (typeof movieId !== "string" || !movieId) {
      throw new AppError("INVALID_REPORT", "movieId is required when reporting a review", 400);
    }
    const ref = db.collection("movies").doc(movieId).collection("reviews").doc(targetId);
    const snap = await ref.get();
    if (!snap.exists) throw new AppError("TARGET_NOT_FOUND", "No such review", 404);
    return { ref, content: (snap.data()?.reviewText as string) ?? "(no review text, rating only)", authorUid: targetId };
  }

  if (targetType === "user") {
    const ref = db.collection("users").doc(targetId);
    const snap = await ref.get();
    if (!snap.exists) throw new AppError("TARGET_NOT_FOUND", "No such user", 404);
    return { ref, content: `Display name: ${snap.data()?.displayName ?? "(unknown)"}`, authorUid: targetId };
  }

  // targetType === "event"
  const ref = db.collection("events").doc(targetId);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError("TARGET_NOT_FOUND", "No such event", 404);
  return { ref, content: `Event title: ${snap.data()?.title ?? "(untitled)"}`, authorUid: snap.data()?.hostId as string };
}

async function applyDecision(
  db: FirebaseFirestore.Firestore,
  targetType: TargetType,
  targetId: string,
  target: ResolvedTarget,
  decision: ModerationDecision
): Promise<void> {
  if (decision.contentAction === "remove") {
    // Soft delete, same general policy as messages/reviews everywhere else in
    // this codebase (schema.md's `deleted` flag) — content survives for
    // audit, never hard-deleted. "user"/"event" targets have no `deleted`
    // field of their own; removal for those is expressed entirely through
    // accountAction instead (restricting/suspending the person or, for an
    // event, its host).
    if (targetType === "message" || targetType === "review") {
      await target.ref.update({ deleted: true });
    }
  }

  if (decision.accountAction === "none") return;

  if (decision.accountAction === "warn") {
    await writeNotification(target.authorUid, "moderationWarning", null, targetType, targetId);
    return;
  }

  const now = new Date();
  const status = decision.accountAction === "restrict" ? "restricted" : "suspended";
  const statusExpiresAt =
    decision.accountAction === "suspend_permanent"
      ? null
      : new Date(now.getTime() + (decision.suspensionDays ?? 7) * 24 * 60 * 60 * 1000);

  await db.collection("users").doc(target.authorUid).update({ status, statusExpiresAt });
  await writeNotification(target.authorUid, "moderationWarning", null, targetType, targetId);
}

// POST /reports — PRD §30.3's "report functionality" + §30.8's AI-assisted
// moderation. Deliberately fully autonomous: Gemini's decision is applied
// immediately, in the same request, with no human queue in between (see
// gemini.ts's header comment for why). When Gemini isn't configured the
// report still gets created — it just sits "pending" forever, since there's
// no fallback human moderator to route it to.
export async function createReport(reporterUid: string, body: CreateReportInput): Promise<CreateReportResult> {
  const { targetType, targetId, reason } = body;
  if (
    typeof targetType !== "string" ||
    !VALID_TARGET_TYPES.includes(targetType as TargetType) ||
    typeof targetId !== "string" ||
    !targetId ||
    typeof reason !== "string" ||
    !reason.trim()
  ) {
    throw new AppError("INVALID_REPORT", `targetType (one of ${VALID_TARGET_TYPES.join("/")}), targetId, and reason are required`, 400);
  }

  const db = requireDb();
  const target = await resolveTarget(db, targetType as TargetType, targetId, body);

  const reportRef = db.collection("reports").doc();
  const now = new Date();
  const reportDoc: Record<string, unknown> = {
    reporterId: reporterUid,
    targetType,
    targetId,
    roomId: typeof body.roomId === "string" ? body.roomId : null,
    movieId: typeof body.movieId === "string" ? body.movieId : null,
    reason: reason.trim(),
    status: "pending",
    decision: null,
    createdAt: now,
    resolvedAt: null
  };

  if (!geminiConfigured) {
    await reportRef.set(reportDoc);
    return { reportId: reportRef.id, status: "pending" as const, decision: null };
  }

  let decision: ModerationDecision;
  try {
    decision = await moderateContent({ targetType: targetType as TargetType, content: target.content, reportReason: reason.trim() });
  } catch {
    reportDoc.status = "error";
    await reportRef.set(reportDoc);
    return { reportId: reportRef.id, status: "error" as const, decision: null };
  }

  await applyDecision(db, targetType as TargetType, targetId, target, decision);

  reportDoc.status = decision.violates ? "actioned" : "dismissed";
  reportDoc.decision = decision;
  reportDoc.resolvedAt = now;
  await reportRef.set(reportDoc);

  return {
    reportId: reportRef.id,
    status: reportDoc.status as "actioned" | "dismissed",
    decision: { ...decision, resolvedAt: toIso(now) }
  };
}
