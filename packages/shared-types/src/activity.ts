// GET /home/activity item — "Friends are watching" (api-contracts.md §7b).
// Types are currently limited to what real write paths produce; "rated"/
// "reviewed" join once Reviews (hld.md §20) exists.
export interface ActivityItem {
  activityId: string
  uid: string
  displayName: string
  type: 'watched' | 'watchlist_added'
  movieId: string
  movieTitle: string | null
  moviePoster: string | null
  createdAt: string | null
}
