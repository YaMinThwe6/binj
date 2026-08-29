// Wire shapes for Events (hld.md §7, api-contracts.md §8).

export interface EventLocation {
  address: string
  lat: number
  lng: number
}

export interface EventSummary {
  eventId: string
  hostId: string
  movieId: string
  title: string | null
  datetime: string | null
  mode: 'online' | 'in-person'
  location: EventLocation | null
  visibility: 'public' | 'private'
  joinCode: string | null // set only when visibility is "private"
  participantLimit: number
  participantCount: number
  requiresApproval: boolean
  createdAt: string | null
}

// GET /events/upcoming item — EventSummary joined with the movie it's for.
export interface UpcomingEvent extends EventSummary {
  movieTitle: string | null
  moviePoster: string | null
}
