# BINJ — API Contracts

Endpoint-level request/response shapes for every flow in [hld.md](hld.md), built on top of [data-model.md](data-model.md) and [schema.md](schema.md). Last stage of the HLD → conceptual model → concrete schema → API contracts sequence.

## Conventions (decided here, not elsewhere — flag if you want these different)

- **Style:** resource-oriented REST, `/api/v1` prefix implied throughout (omitted below for brevity).
- **Auth:** `Authorization: Bearer <Firebase ID token>` on every endpoint marked 🔒. Unmarked endpoints are public reads (§10 — auth only required for writes and user-specific reads).
- **`me`:** any path with `/users/me/...` resolves to the caller's own uid from the verified token — never a client-supplied ID, consistent with §10's "never trust the frontend" principle.
- **Errors:** a single envelope everywhere — `{ "error": { "code": string, "message": string } }` with a matching HTTP status (400 validation, 401 no/bad token, 403 authenticated but not permitted, 404 not found, 409 conflict). Not repeated per endpoint below.
- **Pagination:** cursor-based (`?cursor=<opaque>&limit=<n>`), matching Firestore's own `startAfter` model rather than offset-based paging — response includes `nextCursor: string | null`.
- **Timestamps:** ISO 8601 strings over the wire; stored as Firestore `timestamp` per schema.md.

---

## 1. Movies (§2, §8)

```
GET /movies/:movieId
→ 200 { movieId, title, year, runtime, genres[], synopsis, poster, cast[], crew[],
        voteAverage, binjRating: {sum, count}, streamingProviders[], isAdult }
```
Triggers the cache → Firestore → TMDB fallback chain server-side (§2); streaming providers refresh on their own TTL (§8) but are returned as part of the same response, not a separate call.

## 2. Watchlist & Watched (§3, §5a) 🔒

```
PUT    /users/me/watchlist/:movieId        → 204
DELETE /users/me/watchlist/:movieId        → 204
GET    /users/me/watchlist                 → 200 { items: [{ movieId, addedAt }], nextCursor }

PUT    /users/me/watched/:movieId          body: { watchedAt?, visibility? } → 204
DELETE /users/me/watched/:movieId          → 204
GET    /users/me/watched                   → 200 { items: [{ movieId, watchedAt, visibility }], nextCursor }
PATCH  /users/me/watched/:movieId          body: { visibility } → 204   // per-entry override, §5a
```
`PUT` (not `POST`) since the doc ID is deterministic (`movieId`) — writing is idempotent, matching schema.md's ID strategy.

## 3. Reviews & review bans (§20, §22)

```
GET  /movies/:movieId/reviews              → 200 { items: [{ authorId, rating, reviewText, isAnonymous, createdAt, updatedAt }], nextCursor }
                                              // excludes deleted:true and, per author, respects isAnonymous (authorId withheld client-side when true)

PUT  /movies/:movieId/reviews/me  🔒        body: { rating, reviewText?, isAnonymous } → 200 { rating, reviewText, isAnonymous, createdAt, updatedAt }
                                              // submit or edit — same operation, §20. 403 if an active ReviewBan exists for this movie
DELETE /movies/:movieId/reviews/me 🔒       → 204

POST /movies/:movieId/reviews/:authorId/dispute 🔒
                                              body: { reason } → 201 { disputeId, status: "pending" }
                                              // caller must be :authorId (§22)
```

## 4. Follow / Block / Mute (§4, §19) 🔒

```
POST   /users/:uid/follow                  → 200 { status: "following" | "requested" }
DELETE /users/:uid/follow                  → 204

GET    /users/me/followRequests            → 200 { items: [{ requesterUid, createdAt }], nextCursor }
POST   /users/me/followRequests/:uid/approve → 204
POST   /users/me/followRequests/:uid/deny    → 204

POST   /users/:uid/block                   → 204   // also severs Follow/FollowRequest both directions, §19
DELETE /users/:uid/block                   → 204
POST   /users/:uid/mute                    → 204
DELETE /users/:uid/mute                    → 204
```

## 5. People & taste discovery (§5a, §5b) 🔒

```
GET /movies/:movieId/watchedBy             → 200 { items: [{ uid, displayName, watchedAt }], nextCursor }
                                              // scoped to callers's own `following` list, visibility-filtered (§5a)
GET /users/me/tasteMatches                 → 200 { items: [{ uid, displayName, score }] }
                                              // precomputed, §5b — read-only, no write endpoint (batch job owns this)
```

## 6. Recommendations (§6) 🔒

```
GET /recommendations                       → 200 { items: [movie summary...] }
                                              // content-based live query; cold-start users get trending fallback transparently
```

## 7. Search (§18)

```
GET /search/movies?q=:query                → 200 { items: [{ movieId, title, poster, year }], nextCursor }
                                              // hits Vertex AI Search index only, never TMDB live
```

## 8. Events (§7, §9) 🔒 unless noted

```
POST   /events                             body: { movieId, title?, datetime, mode, location?, visibility,
                                                     participantLimit, requiresApproval, invitedUserIds? }
                                              → 201 { eventId, joinCode?, roomId }
GET    /events/:eventId                    → 200 { ...event fields, participantCount }   // public read, no 🔒 if event.visibility = "public"
GET    /events                             query: { visibility=public, cursor?, limit? } → 200 { items: [...], nextCursor }
GET    /events/nearby                      query: { lat, lng, radiusKm } → 200 { items: [...] }   // §9, geohash range + visibility filter

POST   /events/:eventId/join               body: { joinCode? } → 200 { status: "joined" | "requested" }
GET    /events/:eventId/joinRequests       → 200 { items: [{ uid, createdAt }] }        // host only
POST   /events/:eventId/joinRequests/:uid/approve → 204   // host only
POST   /events/:eventId/joinRequests/:uid/deny    → 204   // host only

PATCH  /events/:eventId                    body: { title?, datetime?, participantLimit?, ... } → 200   // host only, §21
DELETE /events/:eventId                    → 204   // host or moderator, §21
```

## 9. Rooms & messages (§16) 🔒

```
POST   /rooms/:roomId/messages             body: { text } → 201 { messageId, createdAt }
                                              // reads bypass this API entirely — frontend subscribes directly to
                                              // Firestore via onSnapshot per §16, governed by Security Rules, not a GET here
PATCH  /rooms/:roomId/messages/:messageId  body: { text } → 200   // author only, §21
DELETE /rooms/:roomId/messages/:messageId  → 204                  // author or moderator, §21

PATCH  /rooms/:roomId                      body: { type: "persistent" } → 200   // host only, §16 — one-way ephemeral→persistent
POST   /rooms/:roomId/events               body: { datetime, mode, location?, ... } → 201 { eventId }
                                              // schedule a new event from a persistent room; invitedUserIds defaults
                                              // to the room's current memberIds (§16)
```

## 10. Notifications (§17) 🔒

```
GET   /users/me/notifications              query: { unreadOnly?, cursor?, limit? } → 200 { items: [...], nextCursor }
                                              // in-app feed also available via direct Firestore onSnapshot (§17) —
                                              // this GET exists for non-realtime clients / initial load
PATCH /users/me/notifications/:id          body: { read: true } → 204
PATCH /users/me                            body: { notificationPrefs: { emailEnabled } } → 200
POST  /users/me/deviceTokens                body: { token } → 204   // FCM device-token registration, §17
```

## 11. Profile & onboarding (§13) 🔒

```
GET   /users/me                            → 200 { uid, displayName, email, listVisible, followRequiresApproval,
                                                     status, favoriteGenres, notificationPrefs }
PATCH /users/me                            body: { displayName?, listVisible?, followRequiresApproval?, favoriteGenres? } → 200
```
No `POST /users` — profile creation is the lazy, on-first-authenticated-request pattern from §13, not a distinct signup call. `GET /users/me` on a brand-new token is what triggers it server-side.

## 12. Reporting & moderation (§14a, §14b, §14c) 🔒

```
POST /reports                              body: { targetType, targetId, category, reason } → 201 { reportId }

GET  /moderation/reports                   query: { status=pending, cursor?, limit? } → 200 { items: [...] }
                                              // 🔒 + moderator/admin custom claim required, §14b
POST /moderation/reports/:reportId/action  body: { action: "warning"|"removeContent"|"restrict"|"suspend",
                                                     targetType, targetId, expiresAt? } → 200
                                              // 🔒 + moderator/admin claim

GET  /admin/disputes                       query: { status=pending } → 200 { items: [...] }   // 🔒 + admin claim only
POST /admin/disputes/:disputeId/resolve    body: { outcome: "upheld"|"overturned" } → 200      // 🔒 + admin claim only

POST /admin/users/:uid/role                body: { role: "moderator"|"admin"|null } → 204      // 🔒 + admin claim only, §14c
```

## 13. Not REST endpoints — direct client connections

Two flows deliberately bypass this API entirely (§10's "backend validates every request" principle doesn't apply where there's no backend in the path):

- **Presence** (§15) — frontend writes straight to Realtime Database (`presence/{eventId}/{uid}`), no backend endpoint.
- **Room message reads, notification feed reads** (§16, §17) — frontend subscribes directly to Firestore via `onSnapshot`, governed by Security Rules (schema.md §7), not this API. The `GET` endpoints above exist only as a non-realtime fallback/initial-load path.
- **Firebase Auth** (§13) — sign-up/login talks to Firebase Authentication directly, never this API.
- **Google Maps** (§9) — geocoding/rendering calls Maps directly from the frontend.

---

That's the full contract sweep — every flow in hld.md now has either an endpoint or an explicit "no endpoint, direct connection" note. Worth a pass to confirm nothing's missing, or ready to move toward actual scaffolding (Milestone 2) next?
