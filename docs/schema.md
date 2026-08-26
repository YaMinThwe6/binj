# BINJ — Concrete Firestore Schema

Translates [data-model.md](data-model.md)'s entities into exact Firestore collections, field types, IDs, composite indexes, and security rules. Where a field type or ID strategy required a judgment call not already made in the HLD/data-model docs, it's called out inline — flag anything you want changed.

**ID conventions used throughout:**
- Deterministic doc ID (no random ID) where the conceptual model requires structural uniqueness (§20/§22's "one per pair" guarantee) or where the ID *is* the natural foreign key (subcollections keyed by the related user's uid).
- Firestore auto-ID (`.doc()` with no arg) everywhere else — events, messages, reports, disputes, rooms.
- `movieId` is TMDB's own numeric ID, as a string, unprefixed — TMDB is the only movie-data source (§2), so there's no collision risk requiring a prefix.

---

## 1. Identity & Catalog

```
users/{uid}
  displayName: string
  email: string
  createdAt: timestamp
  listVisible: boolean
  followRequiresApproval: boolean
  status: "active" | "restricted" | "suspended"
  statusExpiresAt: timestamp | null      // only set for temporary restrict/suspend
  notificationPrefs: { emailEnabled: boolean }
  favoriteGenres: array<string> | null   // optional onboarding step, §13
```

```
movies/{movieId}                         // doc ID = TMDB id, as string
  title: string
  year: number
  runtime: number | null
  genres: array<string>
  synopsis: string | null
  poster: string | null                  // TMDB image path
  cast: array<{ name: string, character: string }>
  crew: array<{ name: string, role: string }>
  isAdult: boolean
  voteAverage: number                    // TMDB rating
  binjRating: { sum: number, count: number }
  streamingProviders: array<{ name: string, type: "subscription"|"rent"|"buy", logo: string }>
  streamingLastFetched: timestamp | null
  lastFetched: timestamp | null          // full-detail fetch marker, §2
```

---

## 2. Direct User↔Movie relationships

```
users/{uid}/watchlist/{movieId}          // doc ID = movieId
  addedAt: timestamp
```

```
users/{uid}/watched/{movieId}            // doc ID = movieId
  watchedAt: timestamp | null
  visibility: "public" | "private"
```

```
movies/{movieId}/reviews/{authorId}      // doc ID = authorId — structural 1-per-pair (§20)
  rating: number
  reviewText: string | null
  isAnonymous: boolean
  modRemovalCount: number                // §22
  deleted: boolean                       // soft delete, §21
  createdAt: timestamp
  updatedAt: timestamp
```

```
users/{uid}/reviewBans/{movieId}         // doc ID = movieId — structural 1-active-per-pair (§22)
  bannedUntil: timestamp
```

---

## 3. Social graph

```
users/{uid}/following/{followedUid}      // doc ID = followedUid
  createdAt: timestamp

users/{uid}/followers/{followerUid}      // doc ID = followerUid — mirror, §5a
  createdAt: timestamp

users/{uid}/followRequests/{requesterUid}
  createdAt: timestamp

users/{uid}/blocked/{blockedUid}
  createdAt: timestamp

users/{uid}/muted/{mutedUid}
  createdAt: timestamp

users/{uid}/tasteMatches/{matchedUid}    // batch-written, §5b
  score: number
  computedAt: timestamp
```

---

## 4. Events, rooms, messages

```
events/{eventId}                         // auto-ID
  hostId: string
  movieId: string
  title: string | null
  datetime: timestamp
  mode: "online" | "in-person"
  location: { address: string, lat: number, lng: number } | null
  geohash: string | null                 // derived from location, §9
  visibility: "public" | "private"
  participantLimit: number
  requiresApproval: boolean
  joinCode: string | null                // only set when visibility = private
  invitedUserIds: array<string> | null
  roomId: string
  createdAt: timestamp

events/{eventId}/participants/{uid}
  joinedAt: timestamp

events/{eventId}/joinRequests/{uid}
  createdAt: timestamp
```

```
rooms/{roomId}                           // auto-ID, assigned to Event.roomId at event creation (§16)
  type: "ephemeral" | "persistent"
  originEventId: string
  memberIds: array<string>
  createdAt: timestamp

rooms/{roomId}/messages/{messageId}      // auto-ID
  authorId: string
  text: string
  createdAt: timestamp
  editedAt: timestamp | null
  deleted: boolean                       // soft delete, §21 — also the reported-message survival case, §16
```

**Non-Firestore, for completeness:** `presence/{eventId}/{uid}` in Realtime Database — `{ online: boolean, joinedAt: timestamp }`, per §15. Not part of the Firestore schema/indexes below.

---

## 5. Notifications & moderation

```
users/{uid}/notifications/{notificationId}   // auto-ID
  type: string                               // "followRequest" | "eventJoinRequest" | "eventJoinApproved" | "moderationAction" | ...
  fromUserId: string | null                  // omitted for moderationAction, §17
  targetType: string | null
  targetId: string | null
  read: boolean
  createdAt: timestamp
```

```
reports/{reportId}                       // auto-ID
  reporterId: string
  targetType: string                     // "message" | "review" | "event" | "user" | "room"
  targetId: string
  category: string
  reason: string
  status: "pending" | "reviewed" | "dismissed"
  createdAt: timestamp
```

```
users/{uid}/moderationLog/{logId}        // auto-ID
  action: "warning" | "removeContent" | "restrict" | "suspend"
  moderatorId: string
  reportId: string | null
  expiresAt: timestamp | null
  createdAt: timestamp
```

```
moderationDisputes/{disputeId}           // auto-ID
  movieId: string                        // + authorId together identify the disputed review, instead of a single path string
  authorId: string
  moderatorId: string
  status: "pending" | "upheld" | "overturned"
  resolvedByAdminId: string | null
  resolvedAt: timestamp | null
  createdAt: timestamp
```

---

## 6. Composite indexes required

Firestore auto-indexes every single field; composite indexes are only needed where a query filters/sorts on more than one field at once, or combines an array-contains(-any) with anything else. Walking the actual queries traced in the HLD:

| Collection | Index | Powers |
|---|---|---|
| `movies` | `genres` (array-contains-any) + `voteAverage` (desc) | §6 content-based recommendations |
| `events` | `visibility` (asc) + `geohash` (asc) | §9 nearby-events range query, filtered to public |
| `events` | `visibility` (asc) + `datetime` (asc) | Public event browse/upcoming list (implied by §7, not yet an explicit flow — flagging since the schema wants it either way) |
| `reports` | `status` (asc) + `createdAt` (desc) | §14b moderator queue |
| `users/{uid}/notifications` | `read` (asc) + `createdAt` (desc) | §17 in-app feed, unread-first |

Everything else (`movies` sorted only by `voteAverage`, `rooms/{roomId}/messages` ordered by `createdAt`, `tasteMatches` ordered by `score`, all the point-reads by known doc ID) is a single-field query or a direct key lookup — Firestore's automatic indexing already covers those, nothing to declare.

---

## 7. Security Rules — shape, not full syntax

Per §10/§16's principle: **the backend uses the Admin SDK, which bypasses Security Rules entirely** — rules only govern direct client access. Given almost everything in this schema goes through the validated backend (§10), the rules file is mostly deny-by-default, with exactly two carve-outs for the two places §16/§17 established direct frontend reads:

```
match /databases/{database}/documents {

  match /rooms/{roomId} {
    allow read: if request.auth.uid in resource.data.memberIds;
    allow write: if false;                 // backend (Admin SDK) only

    match /messages/{messageId} {
      allow read: if request.auth.uid in get(/databases/$(database)/documents/rooms/$(roomId)).data.memberIds;
      allow write: if false;
    }
  }

  match /users/{uid}/notifications/{notificationId} {
    allow read: if request.auth.uid == uid;
    allow write: if false;
  }

  match /{document=**} {
    allow read, write: if false;           // everything else: backend only
  }
}
```

**Question for you:** should `movies` also get an open client-read rule? Nothing in the HLD currently has the frontend reading Firestore movie docs directly — the detail page (§2) and search (§18) both go through the backend/Vertex AI Search — so I've left it deny-by-default like everything else. Worth confirming that's still true before this becomes the actual rules file, since it's an easy thing to silently get wrong later if a frontend dev reaches for a "quick" direct read.

---

Next natural piece, if you want to keep going: **API contracts** (the backend endpoints themselves — request/response shapes for each flow) — the last stage in the original HLD → conceptual model → concrete schema → API contracts sequence.
