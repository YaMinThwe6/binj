import { db } from "./firebaseAdmin.js";

// schema.md §5 users/{uid}/notifications/{notificationId}. Shared by every flow
// that needs to tell a user something happened without them looking — currently
// Follow requests (hld.md §4) and Event join requests/approvals (hld.md §7).
export type NotificationType = "followRequest" | "followApproved" | "eventJoinRequest" | "eventJoinApproved";

export async function writeNotification(
  uid: string,
  type: NotificationType,
  fromUserId: string | null,
  targetType: string | null = null,
  targetId: string | null = null
): Promise<void> {
  if (!db) return;
  await db.collection("users").doc(uid).collection("notifications").add({
    type,
    fromUserId,
    targetType,
    targetId,
    read: false,
    createdAt: new Date()
  });
}
