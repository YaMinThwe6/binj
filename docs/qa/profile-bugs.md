# Profile page QA notes

**Status: all 5 bugs resolved** (2026-09-04, same day as this report) — see the fix noted under each one below.

Tested `frontend/src/features/profile/components/Profile.tsx` (`/profile/:uid`) against the running dev servers (frontend :3200, backend :6501), signed in as `sundarymt96`. Covered: own profile and another real user's profile (`Fancy Disaster`, uid `6udvWpmuwVg8RcFwAHmPacKzykD2`) at desktop (1440x900), tablet (768x1024) and mobile (375x812) widths; Connect/Following toggle incl. rapid double-click; tab row; nonexistent/malformed uid; console + network throughout; basic keyboard reachability.

Stat/genre-bar accuracy was spot-checked against the backend directly (fetched `/users/me/watched` and each movie's `genres` and recomputed the percentages client-side) — the 48 "Watched" count and all five "Favorite Genres" percentages (Adventure 71%, Action 40%, Fantasy 40%, Animation 33%, Family 33%, including the Action/Fantasy alphabetical tie-break) matched exactly. No discrepancy found there.

## Bugs found

### 1. Desktop Sidebar and AppHeader scroll away instead of staying pinned

**Severity:** real bug (breaks primary navigation while scrolled)

**Repro:**
1. Desktop width (tested 1440x900). Open a profile with enough content to exceed the viewport height, e.g. `/profile/6udvWpmuwVg8RcFwAHmPacKzykD2` (31 watched movies).
2. Scroll the page down.

**Expected:** The left Sidebar (Home/Search/Profile nav, etc.) and the top AppHeader (search, notifications, sign out) stay fixed/pinned while only the profile content scrolls underneath — the usual persistent-app-shell pattern, and what the `lg:overflow-y-auto` on the content `<div>` in `Profile.tsx` is clearly trying to achieve.

**Actual:** The whole document scrolls as one unit. Confirmed via devtools: `document.body.scrollHeight` (1862px) equals the `<aside>` sidebar's own rendered height, and both `<aside>` and `<header>` have `position: static`. Once scrolled down far enough, the sidebar and header are completely off-screen — no Home/Search/Profile nav, no search bar, no sign-out — leaving a large blank gap (the sidebar's own background/border stretched to fill the now-huge row) until you either scroll all the way back to the top or all the way to the very bottom (where the Sidebar's "Settings/Our Story" links, pushed down by `mt-auto`, eventually reappear).

**Root cause (for whoever fixes it):** the outer shell (`<div className="flex min-h-svh ...">`) only sets a *minimum* height, so `lg:overflow-y-auto` on the inner content column never gets a bounded parent to actually scroll within — the browser just scrolls `<body>` instead. This same `min-h-svh` + `lg:overflow-y-auto` pattern is shared by `Home.tsx` (and presumably other pages using this shell), so it's not unique to Profile, but Profile's larger content (48+ watched movies, genre bars, taste match, recent activity) is exactly what makes it show up reliably here.

**Fixed:** added `lg:h-svh` alongside the existing `min-h-svh` on the outer shell's `<div>` — caps the row to the viewport at `lg`, giving `lg:overflow-y-auto` an actually-bounded parent to scroll within; mobile is untouched (`min-h-svh` alone still lets it grow freely with content, matching prior behavior exactly). Applied to `Profile.tsx`, `Home.tsx`, and `MovieDetail.tsx` — same bug, same fix, all three shared this exact shell shape. Verified live post-fix: `<aside>`'s `getBoundingClientRect()` stays fixed at `top:0, bottom:900` (viewport height) on all three pages while the inner content `scrollTop` moves independently; mobile confirmed still scrolls the whole page (`body.scrollHeight` grows with content) and now also correctly shows `MobileTabBar` at the true bottom.

### 2. No mobile bottom nav (MobileTabBar) on the Profile page

**Severity:** real bug (navigation regression on mobile)

**Repro:** Open any profile at mobile width (375x812) and scroll to the bottom.

**Expected:** Per the app's own pattern — `Home.tsx` and `MovieSearch.tsx` both render `<MobileTabBar active="..."/>` at the bottom so "switching between [top-level pages] keeps the same nav surface" (comment in `MobileTabBar.tsx`) — Profile, as another signed-in top-level page reachable from the same Sidebar, would be expected to keep that same bottom nav.

**Actual:** `Profile.tsx` never imports or renders `MobileTabBar`. On mobile there is no bottom nav bar at all on this page — no way to jump to Home/Search/etc. except the "← Back" arrow (which is just `navigate(-1)`, i.e. browser history back, not a guaranteed way home if the profile was opened via a deep link with no prior history).

**Fixed:** `Profile.tsx` now renders `<MobileTabBar active="profile" />`. `MobileTabBar`'s `active` prop type was widened to `'home' | 'search' | 'profile'` — `'profile'` isn't one of the bar's own tabs (no Profile icon there, mirroring how Sidebar's own nav doesn't duplicate itself either), so passing it just leaves both Home and Search rendered as ordinary non-highlighted buttons. Verified live at mobile width: the bar now appears at the true bottom of the page.

### 3. Follower/Following counters don't update after Connect/Unfollow until reload

**Severity:** minor polish

**Repro:**
1. Open another user's profile (relationship `none`), note the "Followers" count.
2. Click Connect.

**Expected:** Followers count increments to reflect the new follow (or at least stays visibly in sync with the button state).

**Actual:** The button correctly flips to "Following" immediately, but "Followers" keeps showing its old value until the page is reloaded. Confirmed the backend itself is correct — reloading shows the incremented count — `toggleConnect` in `Profile.tsx` only patches `profile.relationship` in local state, never the stat counters.

**Fixed:** `toggleConnect` now patches `followerCount` optimistically alongside `relationship` (increment on follow, decrement on unfollow), and rolls it back along with the relationship on a failed request. Covered by new tests (increment on connect, revert on failed connect, decrement on unfollow).

### 4. Wrong icon on the disabled "Message" button

**Severity:** minor polish

**Where:** `Profile.tsx`, the disabled icon button next to Connect/Following on another user's profile (`aria-label="Message"`, `title="Coming soon"`).

**Actual:** The SVG path rendered (`M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 .09 6.19L8.9 13.5a3 3 0 1 0 0 3l6.2 3.31A3 3 0 1 0 15 18l-6.09-3.31a3 3 0 0 0 0-1.38L15 10a3 3 0 0 0 3-2z`) is the standard three-node "Share" glyph, not a message/chat-bubble icon. Visually it reads as "Share" while the accessible name and evident intent are "Message".

**Fixed:** swapped to the same chat-bubble path Sidebar's own "Inbox" row already uses (`M21 11.5a8.4 8.4 0 0 1-8.9 8.4 8.6 8.6 0 0 1-3.6-.8L3 20l1-4.9A8.4 8.4 0 1 1 21 11.5z`) — visual consistency with the app's one existing "messaging" icon rather than inventing a new one.

### 5. Connect/Following button has no in-flight guard — double-click fires duplicate API calls

**Severity:** minor polish (no incorrect end-state observed, but confirmed duplicate requests)

**Repro:** On another user's profile, double-click the Connect/Following button quickly.

**Expected:** One toggle, one API call.

**Actual:** The button isn't disabled while its async call is in flight, so a fast double-click reliably fires two overlapping requests to `PUT/DELETE /users/:uid/follow` (confirmed in the network log every time this was tried). In every repro tried, the final displayed state still matched the persisted backend state after a reload, so this didn't produce a visible desync in testing — but it's a real missing-debounce gap, and the browser network panel does flag one of the two identical concurrent requests as `net::ERR_ABORTED` each time, so it's relying on luck/timing rather than a real guard.

**Fixed:** added a `connectPending` state guard — `toggleConnect` now no-ops if a request is already in flight, and the button gets `disabled={connectPending}` (with a dimmed style) so it's not clickable mid-request either. Covered by a new test asserting `followUser` is called exactly once across three rapid clicks.

## Not a bug (checked, working correctly)

- Own profile vs. other user's profile: taste-match card correctly appears only for other users, never self, at both mobile and desktop.
- Taste-match ring: the SVG stroke-dashoffset visually matches the displayed percentage (spot-checked at 36%).
- Nonexistent uid (`/profile/this-user-does-not-exist-123`) and malformed uids (whitespace-only, `a%2Fb%2Fc`) both fail gracefully with a visible error message and a working "← Back" link — no blank screen, no unhandled crash.
- Disabled tabs (Watched/Watchlist/Reviews/Events) and the disabled Edit Profile/Message buttons use real `disabled` attributes — genuinely inert, correctly skipped in Tab order, no console errors on click.
- Keyboard reachability: Tab order reaches the Connect/Following button and the Overview tab in a sensible sequence.
- Stats and Favorite Genres percentages verified numerically correct against the backend (see above).
