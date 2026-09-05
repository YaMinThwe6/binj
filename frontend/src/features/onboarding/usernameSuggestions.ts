const USERNAME_RE = /^[a-z0-9._]{3,30}$/

function sanitize(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 20)
}

/**
 * Generates candidate usernames from a display name and email — e.g. "Arjun Kumar" /
 * arjun.kumar@gmail.com produces ["arjun.kumar", "arjunkumar", "arjun_kumar", "arjun.k", ...].
 * Pure and deterministic (no availability checking here — that's a separate, async step
 * the caller does per-candidate against the real backend) so it's cheap to unit test.
 */
export function generateUsernameSuggestions(displayName: string, email: string): string[] {
  const nameParts = displayName
    .trim()
    .split(/\s+/)
    .map(sanitize)
    .filter((p) => p.length > 0)
  const emailLocal = sanitize(email.split('@')[0] ?? '')

  const candidates: string[] = []
  const addIfValid = (candidate: string) => {
    if (USERNAME_RE.test(candidate) && !candidates.includes(candidate)) {
      candidates.push(candidate)
    }
  }

  if (emailLocal) addIfValid(emailLocal)

  if (nameParts.length >= 2) {
    const [first, ...rest] = nameParts
    const last = rest[rest.length - 1]
    addIfValid(`${first}.${last}`)
    addIfValid(`${first}${last}`)
    addIfValid(`${first}_${last}`)
    addIfValid(`${first}${last[0] ?? ''}`)
  } else if (nameParts.length === 1) {
    addIfValid(nameParts[0])
  }

  // Numbered fallbacks off the first base candidate, in case all the plain ones are taken.
  const base = candidates[0]
  if (base) {
    for (const suffix of [1, 7, 21, 99]) {
      addIfValid(`${base}${suffix}`.slice(0, 20))
    }
  }

  return candidates
}
