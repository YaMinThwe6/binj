// hld.md §9 — Google Maps' JS API key is frontend-safe (domain-restricted in
// Google Cloud Console, not secret like TMDB's), so reading it directly from
// Vite's env here doesn't violate the "credentials stay backend-only"
// principle. Same graceful-degradation shape as the backend's Gemini
// integration (backend/src/lib/env.ts's geminiConfigured): when the key
// isn't set, mapsConfigured is false and callers fall back to a non-map view
// instead of trying to mount the Maps SDK with no key.
export const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
export const mapsConfigured = Boolean(mapsApiKey)
