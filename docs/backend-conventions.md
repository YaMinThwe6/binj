# BINJ — Backend & Monorepo Conventions

Written 2026-08-29, after the codebase had already grown past its initial scaffold — this document exists because that growth surfaced real gaps (no logging, no lint/format tooling, routes mixing HTTP handling with business logic) worth naming and fixing deliberately, rather than letting each new feature branch improvise its own answer. Partly informed by a reference project (`lms-server-course-core`) the user pointed at for backend structure — some of its conventions are adopted here, some are explicitly declined; each says why.

---

## 1. Tooling

**Lint + format: ESLint + Prettier, one config for the whole monorepo** (`eslint.config.js` and `.prettierrc.json` at the repo root, covering `backend/`, `frontend/`, and `packages/*`). Replaces frontend's earlier `oxlint` setup — a single, more configurable toolchain beats a different linter per package. Run via `pnpm lint` / `pnpm format` / `pnpm format:check` from the root, or `pnpm --filter <pkg> run lint` per package (each package's `lint` script points `--config` back at the root file).

- `backend/**` and `packages/*/src/**` keep their existing style (semicolons, double quotes) via a Prettier `overrides` block — the two packages were written in different styles from the start (backend: semicolons/double-quotes; frontend: no semicolons/single-quotes) and unifying them retroactively would be a large, purely-cosmetic diff with no functional value. New code should match whichever style its own package already uses.
- `react-hooks/set-state-in-effect` is downgraded to `warn` (not `off`, not `error`) — the rule flags several already-tested, idiomatic effect patterns already in the codebase (e.g. "if a dependency goes away, reset state and return early"), fixing all of them is a separate cleanup, but new code should still be nudged away from the pattern.
- `backend/src/lib/tmdb.ts` has `@typescript-eslint/no-explicit-any` turned off for that one file — it parses raw, dynamically-shaped TMDB JSON; modeling TMDB's entire API surface for a handful of parsing call sites isn't worth it. This is a deliberate, scoped exemption, not a blanket allowance.
- **Not yet done:** a repo-wide `pnpm format` pass. The tooling works (verified clean lint run, `prettier --check` runs without error) but running it across ~107 already-existing files would produce a large, unrelated formatting-only diff — left as an optional, separate cleanup commit for whenever it's wanted, not bundled into a feature branch.
- Enforced at commit time: `.husky/pre-commit` runs `pnpm lint && pnpm build && pnpm test` — a commit can't land with lint errors, a broken build, or a failing test.

**Logging: Winston** (`backend/src/lib/logger.ts`), replacing every `console.*` call across backend routes/lib/middleware. Environment-aware:
- `test` → silent (keeps `pnpm test` output readable; the logger still exists and is callable, it just doesn't emit)
- `development` → colorized, human-readable single line
- `production` → structured JSON (timestamp + level + message + metadata), suitable for a log aggregator

Every route's `catch` block logs through `logger.error(...)` instead of `console.error(...)`. No log-shipping destination is wired up yet (the reference project sketches an HTTP transport for production; BINJ doesn't have a log server to point it at) — that's a real gap, tracked here rather than silently deferred, and the transport can be swapped in `logger.ts` alone when one exists, without touching any call site.

**Security headers:** `helmet()` added to the Express app (`backend/src/app.ts`), matching the reference project. No downside, no API contract implication — just missing before.

---

## 2. Folder structure

**Current state:** `backend/src/routes/*.ts` — one file per resource, each route handler doing HTTP concerns (params/body validation, status codes) *and* business logic (Firestore reads/writes, transactions) inline. `lib/` holds cross-cutting infrastructure (Firebase Admin SDK setup, TMDB client, mailer, OTP, notify, logger). `middleware/` holds Express middleware (`requireAuth`). `data/` holds static datasets (curated movie quotes).

**Target state (not yet migrated):** a layered split closer to the reference project's `controllers/` + `services/` + `routes/`:
- `routes/*.ts` — thin: wires an HTTP method + path to a controller function, nothing else.
- `controllers/*.ts` — translates between HTTP (req/res, status codes, the `{error:{code,message}}` envelope — see §3 on whether that survives) and the service layer's plain function calls.
- `services/*.ts` — the actual business logic and Firestore transactions, framework-agnostic (no `req`/`res`), independently testable without `supertest`.

**Decision — not migrating the ~15 existing route files retroactively right now.** It's a large, mechanical change touching every route and every existing test (141 of them), with no functional/behavioral difference to ship alongside — exactly the kind of change that deserves its own dedicated branch under the [[feedback_feature_branch_workflow]] convention, not bundled into an unrelated feature. Tracked here so the next dedicated session has a concrete target instead of re-litigating the shape.

---

## 3. Response envelope

**Current state, live and tested:** `{ error: { code: string, message: string } }` on failure (matching HTTP status), raw JSON (no wrapper) on success. Documented in `docs/api-contracts.md`'s Conventions section, used by all 35+ existing endpoints, asserted on by all 141 backend tests, and parsed by frontend's `apiFetch` (`responseBody?.error?.message`).

**Target state (confirmed direction, not yet executed):** the reference project's `Responder` pattern — `{ success: boolean, message: string, data?: T, statusCode: number }` on *every* response, success or failure, built via `Responder.success(res, message, data, statusCode)` / `Responder.error(res, message, error, statusCode)` static helpers, paired with a single `globalErrorHandler` Express middleware that catches thrown errors instead of every route hand-rolling its own `try/catch` → `res.status(x).json({error:...})`.

**Decision — this is a breaking change, done as its own dedicated branch, after Movie Detail/Reviews ships.** It touches every route's response construction, every test's assertions (`res.body.error.code` → `res.body.data`/`res.body.success`), `frontend/src/lib/api.ts`'s `apiFetch` error parsing, and `docs/api-contracts.md`'s Conventions section + every documented endpoint shape. Doing it well means: describe every scenario (each route's success/error responses under the new shape) before writing the failing tests, same TDD discipline as any other feature — not a mechanical find-replace that happens to pass existing tests by accident.

---

## 4. What this doesn't change

The [[feedback_feature_branch_workflow]] convention (one feature per branch, scenarios-then-tests-then-code, commit → merge → delete branch) and the [[feedback_no_ai_attribution_in_commits]] rule both still apply, including to the two migrations tracked above when their time comes.
