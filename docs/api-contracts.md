# BINJ — API Contracts

Endpoint-level request/response shapes for every flow in [hld.md](hld.md), built on top of [data-model.md](data-model.md) and [schema.md](schema.md). Last stage of the HLD → conceptual model → concrete schema → API contracts sequence.

## Conventions (decided here, not elsewhere — flag if you want these different)

- **Style:** resource-oriented REST, `/api/v1` prefix implied throughout (omitted below for brevity).
- **Auth:** `Authorization: Bearer <Firebase ID token>` on every endpoint marked 🔒. Unmarked endpoints are public reads (§10 — auth only required for writes and user-specific reads).
- **`me`:** any path with `/users/me/...` resolves to the caller's own uid from the verified token — never a client-supplied ID, consistent with §10's "never trust the frontend" principle.
- **Errors:** a single envelope everywhere — `{ "error": { "code": string, "message": string } }` with a matching HTTP status (400 validation, 401 no/bad token, 403 authenticated but not permitted, 404 not found, 409 conflict). Not repeated per endpoint below.
- **Pagination:** cursor-based (`?cursor=<opaque>&limit=<n>`), matching Firestore's own `startAfter` model rather than offset-based paging — response includes `nextCursor: string | null`.
- **Timestamps:** ISO 8601 strings over the wire; stored as Firestore `timestamp` per schema.md.
- **Types:** every response shape documented below has a matching TypeScript interface in `packages/shared-types` (`@binj/shared-types`, a pnpm workspace package) — both `backend/src/routes/*.ts` and `frontend/src/lib/api.ts` import from it rather than declaring their own copies, so the two sides can't silently drift apart.

---

## 1. Movies (§2, §8)

```
GET /movies/:movieId
→ 200 { movieId, title, year, runtime, genres[], synopsis, poster, cast[], crew[],
        voteAverage, voteCount, trailerKey, binjRating: {sum, count}, likeCount,
        streamingProviders[], isAdult }
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

PUT    /users/me/likes/:movieId            → 204   // toggle on; movies.likeCount += 1 (idempotent — no-op if already liked)
DELETE /users/me/likes/:movieId            → 204   // toggle off; movies.likeCount -= 1
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
PUT    /users/:uid/follow                  → 200 { status: "following" | "pending" }
DELETE /users/:uid/follow                  → 204   // unfollows, or cancels a pending request

GET    /users/me/followRequests            → 200 { items: [{ uid, displayName, photoURL }] }
POST   /users/me/followRequests/:uid/approve → 204
POST   /users/me/followRequests/:uid/deny    → 204

POST   /users/:uid/block                   → 204   // also severs Follow/FollowRequest both directions, §19
DELETE /users/:uid/block                   → 204
POST   /users/:uid/mute                    → 204
DELETE /users/:uid/mute                    → 204
```

**Implementation note:** `Follow`/`Unfollow` are `PUT`/`DELETE`, not `POST` — consistent with every other "set this relationship" endpoint in this API (watchlist, watched, followedCelebrities), and idempotent by construction (repeat calls don't duplicate writes or notifications). `status: "pending"` replaces the originally-sketched `"requested"` to match the `followRequests` collection's own vocabulary. Block/Mute are not implemented yet (§19 is a separate, later flow) — Follow/Unfollow/approve/deny are real and live in `backend/src/routes/follow.ts`.

## 5. People & taste discovery (§5a, §5b) 🔒

```
GET /movies/:movieId/watchedBy             → 200 { items: [{ uid, displayName, watchedAt }], nextCursor }
                                              // scoped to callers's own `following` list, visibility-filtered (§5a)
GET /users/me/tasteMatches                 → 200 { items: [{ uid, displayName, score, relationship }] }
                                              // precomputed, §5b — read-only, no write endpoint (batch job owns this).
                                              // relationship: "following" | "pending" | "none" — joined in live against
                                              // §4's Follow collections so Home's "Connect" button can render the
                                              // right label/state without a second round-trip.

PUT    /users/me/followedCelebrities/:personId    → 204
DELETE /users/me/followedCelebrities/:personId    → 204
GET    /users/me/followedCelebrities              → 200 { items: [{ personId, name, photo }], nextCursor }

GET /onboarding/celebrity-suggestions      → 200 { items: [{ personId, name, photo, appearsIn: number }] }
                                              // §13's onboarding step — ranks cast/crew from the caller's already-saved
                                              // watched movies by frequency, then popularity; empty history → empty list,
                                              // no fallback (this step is skippable, unlike Watched's trending fallback)
```

## 6. Recommendations (§6) 🔒

```
GET /recommendations                       → 200 { items: [{ movieId, title, poster, year, genres, voteAverage,
                                                              matchScore: number | null }] }
                                              // content-based live query; cold-start users get trending fallback transparently
```

**Implementation note:** `matchScore` (0-100, "Top picks for you"'s % badge) is a heuristic, not a learned model — 70% weight on how much of the caller's preferred-genre set a candidate covers, 30% weight on its own TMDB rating. It's `null` for the trending/cold-start fallback, which has no preference to score against — the frontend shows the rating alone in that case, no "% match" badge.

## 7. Search (§18)

```
GET /search/movies?q=:query                → 200 { items: [{ movieId, title, poster, year }], nextCursor }
                                              // hits Vertex AI Search index only, never TMDB live
```

## 7b. Home 🔒

```
GET /home/greeting                         → 200 { quote, attribution, source: "watched" | "random" }
GET /home/activity                         → 200 { items: [{ activityId, uid, displayName, type, movieId,
                                                              movieTitle, moviePoster, createdAt }] }
```

**Implementation note (mockup-driven, no prior hld.md flow):** `/home/greeting` is hld.md §6/§13's movie-dialogue greeting — a small curated quote set (`backend/src/data/movieQuotes.ts`, tagged by real TMDB movie id) prefers a match against the caller's watched list (`source: "watched"`) and falls back to a random pick otherwise (`source: "random"`), which is exactly the "first Home visit is already personalized" behavior §13 called for. `/home/activity` is "Friends are watching" — same fan-out shape as §5a (bounded by the caller's own `following` list, never a global feed), reading a new top-level `activity/{activityId}` collection (schema.md) that `watchlist`/`watched` writes append to (skipped for a `watched` entry marked `visibility: "private"`, respecting §5a's per-entry override). Types are currently `"watched"` and `"watchlist_added"` — `"rated"`/`"reviewed"` join once Reviews (§20) exists.

## 8. Events (§7, §9) 🔒 unless noted

```
POST   /events                             body: { movieId, title?, datetime, mode: "online"|"in-person", location?,
                                                     visibility: "public"|"private", participantLimit, requiresApproval,
                                                     invitedUserIds? }
                                              → 201 { eventId, ...event fields, joinCode? (private only) }
                                              // host auto-joins; a rooms/{roomId} doc is created alongside so §16's
                                              // chat has something real to attach to later, even though the chat
                                              // UI itself isn't built yet
GET    /events/upcoming                    query: { limit? } → 200 { items: [{ ...event fields, movieTitle, moviePoster }] }
                                              // public + future only, sorted by datetime asc — powers Home's
                                              // "Upcoming watch events". Not yet personalized (invited/joined-only
                                              // browsing, §9 nearby, and a movieId-scoped variant are still planned)

PUT    /events/:eventId/join               → 200 { status: "joined" | "pending" }
                                              // branches on the event's own requiresApproval, re-checked server-side;
                                              // 409 EVENT_FULL if participantCount is already at participantLimit.
                                              // joinCode-based lookup for private events isn't wired up yet — join
                                              // currently needs the eventId directly
DELETE /events/:eventId/join               → 204   // leaves the event, or cancels a pending request
GET    /events/:eventId/joinRequests       → 200 { items: [{ uid, displayName }] }        // host only
POST   /events/:eventId/joinRequests/:uid/approve → 204   // host only, re-checks capacity, 409 EVENT_FULL if it filled up while pending
POST   /events/:eventId/joinRequests/:uid/deny    → 204   // host only

GET    /events/:eventId                    → 200 { ...event fields, participantCount }   // not yet implemented
GET    /events/nearby                      query: { lat, lng, radiusKm } → 200 { items: [...] }   // §9, not yet implemented
PATCH  /events/:eventId                    body: { title?, datetime?, participantLimit?, ... } → 200   // §21, not yet implemented
DELETE /events/:eventId                    → 204   // §21, not yet implemented
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
GET   /users/me/notifications              query: { unreadOnly?, limit? } → 200 { items: [{ id, type, fromUserId,
                                                       targetType, targetId, read, createdAt }] }
                                              // powers Home's bell badge; a full notification-center UI and cursor
                                              // pagination are still planned — this is the read surface only
PATCH /users/me/notifications/:id          body: { read: true } → 204
PATCH /users/me                            body: { notificationPrefs: { emailEnabled } } → 200   // not yet implemented
POST  /users/me/deviceTokens                body: { token } → 204   // FCM device-token registration, not yet implemented
```

**Implementation note:** `type` is currently written by exactly two flows — Follow (`followRequest`, `followApproved`) and Events (`eventJoinRequest`, `eventJoinApproved`) — via the shared `backend/src/lib/notify.ts` helper. `moderationAction` and the rest of §17's full type list land when their owning flows do.

## 11. Profile & onboarding (§13)

```
POST  /auth/email/start                    body: { email } → 204   // unauthenticated — no token exists yet
POST  /auth/email/verify                   body: { email, code } → 200 { customToken }   // unauthenticated
```
Both unauthenticated by necessity (§13's Email+OTP branch) — `start` generates a 6-digit code, hashes it, stores `authCodes/{email}` (schema.md), and emails it. `verify` checks the hash + expiry + attempt count, then calls the Admin SDK to create-or-look-up the Firebase Auth user for that email and mints a custom token via `createCustomToken()`. The frontend calls `signInWithCustomToken()` with the result, converging into the same ID-token state as the OAuth branch — from that point on, every other endpoint below is identical regardless of which of the three sign-in paths was used.

**Decision — direct SMTP instead of the Firebase "Trigger Email" extension named in hld.md §17.** The extension requires the Blaze (pay-as-you-go) plan and a console install step; sending directly via `nodemailer` against Gmail SMTP achieves the exact same outcome (backend generates a code, emails it) with no billing-plan dependency and no extra console round-trip — worth doing given the tight implementation timeline. `hld.md`'s notification emails (§17) can still move to the extension later; this doesn't reopen that decision, it just doesn't block the OTP path on it now.

🔒
```
GET   /users/me                            → 200 { uid, displayName, username, email, photoURL, listVisible,
                                                     followRequiresApproval, status, favoriteGenres, preferredLanguages,
                                                     onboardingComplete, notificationPrefs, themePreference, accentTheme,
                                                     isNewUser }
PATCH /users/me                            body: { displayName?, username?, listVisible?, followRequiresApproval?,
                                                     favoriteGenres?, preferredLanguages?, onboardingComplete?,
                                                     themePreference?, accentTheme? } → 200
                                              // setting username: 409 USERNAME_TAKEN if the usernames/{username}
                                              // reservation belongs to someone else; releases the caller's old
                                              // reservation (if any) and creates the new one, same request

GET   /users/username-available            query: { username } → 200 { available: boolean }
                                              // real-time check for onboarding step 3's UI, unauthenticated (no
                                              // account exists to attach a reservation to yet, for the OAuth
                                              // branches this still runs before the wizard's PATCH)

GET   /onboarding/watched-candidates       query: { genres?, languages? } → 200 { items: [movie summary...] }
                                              // §13's Watched step — filtered by the genres/languages just chosen in
                                              // the prior steps when present, trending fallback otherwise (same
                                              // cold-start shape as §6, no watched/watchlist exclusion — the point
                                              // here is surfacing candidates *to* mark watched, not hiding them)
```
No `POST /users` — profile creation is the lazy, on-first-authenticated-request pattern from §13, not a distinct signup call. `GET /users/me` on a brand-new token is what triggers it server-side — `isNewUser` is `true` only on that exact bootstrap call (hld.md §13's flow diagram calls this out explicitly: "return 'new user' flag"), `false` on every call after. The frontend's actual "should I show onboarding" check is `isNewUser || !onboardingComplete` — the flag alone doesn't catch a user who signed up, got partway through the wizard, and closed the app.

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
