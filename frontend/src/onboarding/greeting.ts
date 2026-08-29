import type { MovieCandidate } from '../lib/api'

// Seeds the very first Home greeting from whatever the user marked as watched
// during onboarding. Picks the highest-rated title as the anchor; falls back to
// a generic welcome when nothing was marked watched (step is skippable).
export function buildFirstGreeting(watched: MovieCandidate[]): string | null {
  if (watched.length === 0) return null

  const top = [...watched].sort((a, b) => b.voteAverage - a.voteAverage)[0]
  if (watched.length === 1) {
    return `Since you've watched ${top.title}, we've got more like it lined up for you.`
  }
  return `Since you've watched ${top.title} and ${watched.length - 1} other movie${watched.length - 1 === 1 ? '' : 's'}, we've got recommendations ready for you.`
}
