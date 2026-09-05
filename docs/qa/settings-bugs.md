# Settings page QA notes

**Status: both bugs resolved** (2026-09-04, same day as this report) — see the fix noted under each one below.

Tested `frontend/src/features/settings/components/Settings.tsx` (`/settings`) against the running dev servers (frontend :3200, backend :6501), signed in as `sundarymt96` (uid `AefQmxq3MFPgIYVodMjovIcBGjz1`). Covered: display name + username editing (valid save + reload persistence, too-short/invalid-character username, already-taken username, save blocked while unconfirmed), all six accent swatches (apply + persist + propagate to Home and Profile), Privacy toggles (watched-list visibility, follow-approval), Notifications email toggle (persist across reload), Sign out, the disabled Delete account link, rapid double-click on a toggle, desktop (1280x720) and mobile (375x812) widths, and keyboard Tab-order/roles. Console and network were checked throughout, not just at the end — no console errors were seen at any point in the session.

All test edits were reverted back to the account's original values (display name/username `sundarymt96`, accent `emerald`, watched-list visible on, follow-approval off, email notifications on) before finishing.

## Bugs found

### 1. AppHeader's displayName/avatar-initial don't update after a Settings save until a full reload

**Severity:** real bug (stale UI, self-corrects on reload, but visibly contradicts what was just saved)

**Repro:**
1. On `/settings`, change Display name (e.g. `sundarymt96` → `Sundary QA Test`) and click Save changes.
2. Watch the top-right of `AppHeader` (the name next to the avatar circle, shared across every signed-in page).

**Expected:** Per `Settings.tsx`'s own code comment — "App.tsx owns the single `me` state Home/AppHeader/theme.ts's applyAccentTheme effect all read from ... so an accent change (for instance) actually re-triggers App's effect instead of only looking changed on this page and reverting elsewhere" — AppHeader should reflect the new display name immediately, the same session, no reload needed.

**Actual:** AppHeader keeps showing the old display name (and old avatar initial letter) after a successful save — confirmed the PATCH succeeded and returned the new value (`"displayName":"sundarymt96"` in the response body) while the header still read "Sundary QA Test". Only a full page reload (which re-mounts AppHeader) picks up the change.

**Root cause:** `frontend/src/components/AppHeader.tsx` does not receive `me` as a prop from `App.tsx`'s shared state (unlike `Settings`, which receives `me`/`onUpdateMe`). Instead it fetches its own independent copy via `getMe()` in a `useEffect(() => {...}, [])` that only runs once on mount, so it never observes `App`'s `setMe` calls. This is why accent-theme changes *do* appear to propagate live everywhere (that's driven by a separate `applyAccentTheme` effect in `App.tsx` writing CSS custom properties to the document root, not by AppHeader's own `me`), while displayName — which AppHeader reads from its own stale local `me` — does not.

**Fixed:** `AppHeader` now accepts an optional `me` prop — when supplied, it's used directly and the component's own `getMe()` fetch is skipped entirely; when omitted (as on `MovieDetail.tsx`/`Profile.tsx`, which don't have `me` in scope from `App.tsx`), it falls back to fetching its own copy exactly as before, so this is backward-compatible. `Settings.tsx` now passes its own `me` prop through. Covered by a new test asserting a re-render with an updated `me` prop reflects immediately with no `getMe()` call. Not live-verified in-browser this pass — the test session had signed itself out (from the tester agent's own Sign-out repro) and re-authenticating needs a fresh OTP; the fix is covered precisely by a passing unit test instead.

### 2. Turning off "Show my watched list" also hides the watched list from the owner's own profile page

**Severity:** real bug (looks like your own data disappeared)

**Repro:**
1. On `/settings` → Privacy, toggle "Show my watched list" off and confirm it saves.
2. Navigate to your own profile (`/profile/<your-own-uid>`, e.g. via the Sidebar's Profile link).
3. Look at the "Recently watched" section.

**Expected:** The toggle's own description says "Anyone who visits your profile can see it" — implying it should only hide the list from *other* visitors. The owner viewing their own profile should always be able to see their own watched list, same as before.

**Actual:** The owner's own profile page shows "This user's watched list is private." exactly as it would for someone else — even though `sundarymt96` is looking at `sundarymt96`'s own profile. The stat counters ("48 Watched", genre bars, etc.) still render correctly; only the "Recently watched" preview and "Recent Activity" section are hidden.

**Root cause:** `backend/src/services/users.service.ts`'s `getPublicProfile` computes `watchedListVisible = target.listVisible === true` and gates `watched`/`recentActivity` on it with no exception for `callerUid === targetUid` (it does special-case `relationship = "self"` a few lines above, but that flag isn't used for the visibility gate). `frontend/src/features/profile/components/Profile.tsx` then renders "This user's watched list is private." purely off `profile.watchedListVisible`, regardless of whether the viewer is the profile owner.

**Fixed:** backend now populates `watched`/`recentActivity` when `watchedListVisible || isSelf` — `watchedListVisible` itself still reports the real underlying setting unchanged (it's a legitimate "is this visible to others" fact, not just a gate), so the frontend's three render conditions (private message / empty state / list) were each updated to check `profile.watchedListVisible || isSelf` too, using the `isSelf` flag `Profile.tsx` already computed. Covered by a new backend test (self sees their own watched entry even with `listVisible: false`) and a new frontend test (self sees the list rendered, not the private message, in that same state).

## Not a bug (checked, working correctly)

- Display name save → reload: persists correctly (confirmed via PATCH response and a full reload).
- Username validation: too-short/invalid-character input (e.g. `ab`) shows "3-30 characters: lowercase letters, numbers, dots, underscores" immediately and Save changes stays disabled (no PATCH fires on click).
- Username validation: an already-taken username (`fancydisaster`, another real user) shows "That username is taken" and Save changes stays disabled (no PATCH fires on click).
- Save is correctly gated on `availability === 'available'`, so it can't fire mid-check or on a rejected value; confirmed no duplicate/erroneous PATCH in any of these blocked cases.
- All six accent swatches apply instantly (Settings' own UI, Sidebar, buttons, toggles all re-tint immediately), persist across reload, and correctly propagate to Home and Profile pages after a fresh load.
- Watched-list visibility and follow-approval-required toggles both persist correctly across reload.
- Email-notifications toggle persists correctly across reload.
- Sign out works, clears the session, and lands on the public signed-out movie-discovery page (sensible landing, not a dead end).
- The disabled "Delete account" link is genuinely inert: no console error, no navigation, no network request on click.
- Rapid back-to-back clicks on a Privacy toggle each fired their own PATCH (no in-flight guard in the code), but the two requests resolved in order and the final persisted state matched what two real toggles should produce — no incorrect end-state observed.
- Mobile width (375x812): all sections (Profile, Appearance, Privacy, Notifications, Account) render correctly, MobileTabBar appears at the bottom. The six accent swatches sit in a horizontally-scrollable row (`overflow-x-auto`) and the sixth swatch (Red) is genuinely reachable by scrolling the row — initially looked cut off but is not a bug.
- Keyboard: Tab reaches Display name → Username → Save changes → each accent swatch → each toggle in a sensible order; swatches expose `aria-pressed`/`aria-label` and toggles expose `role="switch"`/`aria-checked`/`aria-label` correctly (real accessible roles/states, not just styled to look like something). Note: activating a focused button via the Enter/Space key could not be reliably verified in this environment — even a plain, mouse-confirmed-working button (Save changes) didn't respond to a simulated key press, indicating a testing-tool limitation rather than a demonstrated app defect, so it is not reported as a bug.
