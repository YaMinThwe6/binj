// Wire shapes for Rooms & messages (hld.md §16, api-contracts.md §9).
// Message reads bypass the backend API entirely — the frontend subscribes
// directly to Firestore (rooms/{roomId}/messages) via onSnapshot, governed by
// Security Rules, not this package. This type still documents the doc shape
// both the frontend's onSnapshot listener and the backend's write path share.

export interface RoomMessage {
  messageId: string
  authorId: string
  text: string
  createdAt: string | null
  editedAt: string | null
  deleted: boolean
}

export interface Room {
  roomId: string
  type: 'ephemeral' | 'persistent'
  originEventId: string
  memberIds: string[]
  createdAt: string | null
}
