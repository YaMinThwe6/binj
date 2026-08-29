import type { Me } from './api'

// PRD §8 — accentTheme has been stored/settable via PATCH /users/me since
// onboarding, but nothing ever actually applied it to the UI. index.css
// defines each accent as a `:root[data-accent="..."]` block; this just
// keeps that attribute in sync with the signed-in user's choice. Defaults
// to emerald (index.css's own :root fallback) for signed-out screens,
// which have no `me` yet.
export function applyAccentTheme(accentTheme: Me['accentTheme'] | undefined): void {
  document.documentElement.dataset.accent = accentTheme ?? 'emerald'
}
