import { useEffect, useState } from 'react'
import { getUserProfile, type PublicProfile } from '../services/profileApi'
import { followUser, unfollowUser } from '../../home/services/homeApi'

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
      <main className="profile-page">
        <button type="button" onClick={onBack}>← Back</button>
        <p role="alert">{error}</p>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="profile-page">
        <p>Loading…</p>
      </main>
    )
  }

  return (
    <main className="profile-page">
      <button type="button" onClick={onBack}>← Back</button>

      <header className="profile-header">
        <div className="avatar">{profile.displayName.charAt(0).toUpperCase()}</div>
        <h1>{profile.displayName}</h1>
        {profile.username && <p className="username">@{profile.username}</p>}
        <div className="profile-counts">
          <span>{profile.followerCount} followers</span>
          <span>{profile.followingCount} following</span>
        </div>
        {profile.relationship !== 'self' && (
          <button type="button" onClick={toggleConnect}>{connectLabel(profile.relationship)}</button>
        )}
      </header>

      {error && <p role="alert">{error}</p>}

      {(profile.favoriteGenres?.length || profile.preferredLanguages?.length) && (
        <section className="profile-preferences">
          {profile.favoriteGenres?.length ? <p>Favorite genres: {profile.favoriteGenres.join(', ')}</p> : null}
          {profile.preferredLanguages?.length ? <p>Preferred languages: {profile.preferredLanguages.join(', ')}</p> : null}
        </section>
      )}

      <section className="profile-watched">
        <h2>Recently watched</h2>
        {!profile.watchedListVisible && <p>This user's watched list is private.</p>}
        {profile.watchedListVisible && profile.watched.length === 0 && <p>No public watched movies yet.</p>}
        {profile.watchedListVisible && profile.watched.length > 0 && (
          <ul>
            {profile.watched.map((entry) => (
              <li key={entry.movieId}>
                <span>{entry.title ?? 'Untitled'}</span>
                <span className="watched-at">{formatWatchedAt(entry.watchedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
