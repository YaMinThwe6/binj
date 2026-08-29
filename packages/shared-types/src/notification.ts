// Notifications (hld.md §17, api-contracts.md §10). `type` is currently written
// by exactly two flows — Follow and Events — via the backend's shared
// `notify.ts` helper; the rest of §17's type list lands with their owning flows.
export type NotificationType = 'followRequest' | 'followApproved' | 'eventJoinRequest' | 'eventJoinApproved' | 'moderationWarning'

export interface NotificationItem {
  id: string
  type: NotificationType
  fromUserId: string | null
  targetType: string | null
  targetId: string | null
  read: boolean
  createdAt: string | null
}
