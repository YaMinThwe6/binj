import { useEffect, useState } from 'react'
import { getUserProfile, type PublicProfile } from '../services/profileApi'
import { followUser, unfollowUser } from '../../home/services/homeApi'
import { posterUrl } from '../../../lib/images'

interface Props {
  uid: string
  onBack: () => void
}

function connectLabel(relationship: PublicProfile['relationship']): string {
  if (relationship === 'following') return 'Following'
  if (relationship === 'pending') return 'Requested'
  return 'Connect'
}

function formatWatchedAt(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// hld.md §5c — the destination "people who watched this"/"taste match" cards
// now link to, and the frontend's read of the same privacy-filtered public
// profile the backend computes (api-contracts.md §11b). Follow/unfollow
// reuses homeApi's calls rather than re-implementing them — same backend
// endpoints as PeopleYouMightVibeWith's Connect button.
export function Profile({ uid, onBack }: Props) {
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setProfile(null)
    setError('')
    getUserProfile(uid)
      .then(setProfile)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load profile'))
  }, [uid])

  async function toggleConnect() {
    if (!profile) return
    const previous = profile.relationship

    if (previous === 'none') {
      setProfile({ ...profile, relationship: 'pending' })
      try {
        const { status } = await followUser(uid)
        setProfile((prev) => (prev ? { ...prev, relationship: status } : prev))
      } catch (err) {
        setProfile((prev) => (prev ? { ...prev, relationship: 'none' } : prev))
        setError(err instanceof Error ? err.message : 'Failed to connect')
      }
    } else {
      setProfile({ ...profile, relationship: 'none' })
      try {
        await unfollowUser(uid)
      } catch (err) {
        setProfile((prev) => (prev ? { ...prev, relationship: previous } : prev))
        setError(err instanceof Error ? err.message : 'Failed to update')
      }
    }
  }

  if (error && !profile) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-bg px-6 text-text">
        <button type="button" onClick={onBack} className="self-start text-sm font-semibold text-text-secondary">
          ← Back
        </button>
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-bg text-text">
        <p className="text-sm text-text-muted">Loading…</p>
      </main>
    )
  }

  const connectButton = connectLabel(profile.relationship)

  return (
    <main className="min-h-svh bg-bg text-text">
      {/* banner */}
      <div
        className="relative h-24 w-full overflow-hidden"
        style={{
          background:
            'radial-gradient(120% 90% at 85% 5%, rgba(150,170,200,0.14), transparent 55%), radial-gradient(100% 80% at 15% 95%, rgba(var(--accent-rgb),0.2), transparent 55%), linear-gradient(180deg, #1B1720 0%, #100E12 100%)'
        }}
      >
        <div className="absolute top-4 left-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/10 bg-black/55"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#F3F1ED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* identity, centered */}
      <div className="-mt-13 flex flex-col items-center px-6 text-center">
        <div className="flex h-[104px] w-[104px] items-center justify-center overflow-hidden rounded-full border-4 border-bg bg-[rgba(var(--accent-rgb),0.16)]">
          {profile.photoURL ? (
            <img src={profile.photoURL} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-serif text-[32px] font-semibold text-accent">{profile.displayName.charAt(0).toUpperCase()}</span>
          )}
        </div>

        <h1 className="mt-3.5 font-serif text-[23px] font-semibold text-white">{profile.displayName}</h1>
        {profile.username && <p className="mt-0.5 text-[12.5px] text-text-muted">@{profile.username}</p>}

        {profile.relationship !== 'self' && (
          <button
            type="button"
            onClick={toggleConnect}
            className={
              connectButton === 'Connect'
                ? 'mt-4.5 min-w-[172px] rounded-xl bg-accent px-6 py-3 text-[13.5px] font-bold text-bg'
                : 'mt-4.5 min-w-[172px] rounded-xl border border-border bg-surface-alt px-6 py-3 text-[13.5px] font-bold text-text'
            }
          >
            {connectButton}
          </button>
        )}

        <div className="mt-5 flex w-full border-t border-b border-border-soft py-3.5">
          <div className="flex-1 border-r border-border-soft">
            <div className="text-[15px] font-bold text-text">{profile.followerCount}</div>
            <div className="mt-0.5 text-[9.5px] text-text-muted">Followers</div>
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-bold text-text">{profile.followingCount}</div>
            <div className="mt-0.5 text-[9.5px] text-text-muted">Following</div>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 px-6 text-center text-[13px] text-red-400">
          {error}
        </p>
      )}

      {(profile.favoriteGenres?.length || profile.preferredLanguages?.length) && (
        <section className="px-6 pt-6 text-left">
          {profile.favoriteGenres?.length ? (
            <p className="mb-2 text-[12.5px] text-text-secondary">
              <span className="font-semibold text-text">Favorite genres: </span>
              {profile.favoriteGenres.join(', ')}
            </p>
          ) : null}
          {profile.preferredLanguages?.length ? (
            <p className="text-[12.5px] text-text-secondary">
              <span className="font-semibold text-text">Preferred languages: </span>
              {profile.preferredLanguages.join(', ')}
            </p>
          ) : null}
        </section>
      )}

      <section className="px-6 py-7">
        <h2 className="mb-3 text-[15px] font-bold text-text">Recently watched</h2>
        {!profile.watchedListVisible && <p className="text-sm text-text-muted">This user's watched list is private.</p>}
        {profile.watchedListVisible && profile.watched.length === 0 && <p className="text-sm text-text-muted">No public watched movies yet.</p>}
        {profile.watchedListVisible && profile.watched.length > 0 && (
          <ul className="flex flex-col gap-3">
            {profile.watched.map((entry) => {
              const poster = posterUrl(entry.poster, 'w185')
              return (
                <li key={entry.movieId} className="flex items-center gap-3">
                  <div className="h-12 w-9 flex-none overflow-hidden rounded-md bg-surface-alt">
                    {poster && <img src={poster} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-text">{entry.title ?? 'Untitled'}</span>
                    <span className="text-[11px] text-text-muted">{formatWatchedAt(entry.watchedAt)}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
