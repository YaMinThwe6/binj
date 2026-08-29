import { apiFetch } from '../../../lib/api'
export type { PublicProfile } from '@binj/shared-types'
import type { PublicProfile } from '@binj/shared-types'

// GET /users/:uid — api-contracts.md §11b. The public-facing counterpart to
// lib/api.ts's getMe: what any signed-in caller sees on someone else's
// profile, privacy-filtered server-side.
export function getUserProfile(uid: string): Promise<PublicProfile> {
  return apiFetch(`/users/${uid}`, { auth: true })
}
