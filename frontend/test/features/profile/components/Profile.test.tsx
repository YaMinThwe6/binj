import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const getUserProfile = vi.fn()
const followUser = vi.fn()
const unfollowUser = vi.fn()
const getNotifications = vi.fn().mockResolvedValue({ items: [] })

vi.mock('../../../../src/features/profile/services/profileApi', () => ({ getUserProfile }))
vi.mock('../../../../src/features/home/services/homeApi', () => ({ followUser, unfollowUser, getNotifications }))

// AppHeader's own dependency (rendered for real below, not mocked away, same
// as MovieDetail.test.tsx treats Sidebar/AppHeader) — nothing specific to
// Profile worth asserting beyond "the signed-in shell is there".
const getMe = vi.fn().mockResolvedValue({ displayName: 'Yamin', email: 'yamin@example.com' })
vi.mock('../../../../src/lib/api', () => ({ getMe }))

// Profile is only ever reached signed-in (App.tsx's "/profile/:uid" route
// doesn't exist in the guest route table) — this mock just supplies
// AppHeader's onSignOut handler, same as MovieDetail.test.tsx's.
vi.mock('../../../../src/lib/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'caller-1' }, loading: false, signInWithGoogle: vi.fn(), signInWithMicrosoft: vi.fn(), signInWithToken: vi.fn(), signOutUser: vi.fn() })
}))

const { Profile } = await import('../../../../src/features/profile/components/Profile')

const baseProfile = {
  uid: 'u1',
  displayName: 'Rohan',
  username: 'rohan.movies',
  photoURL: null,
  favoriteGenres: ['Sci-Fi', 'Thriller'],
  preferredLanguages: null,
  followerCount: 12,
  followingCount: 8,
  relationship: 'none' as const,
  watchedListVisible: true,
  watched: [{ movieId: 'm1', title: 'Interstellar', poster: null, watchedAt: '2026-01-01T00:00:00.000Z' }],
  joinedAt: '2026-06-01T00:00:00.000Z',
  watchedCount: 98,
  watchlistCount: 21,
  reviewCount: 37,
  topGenres: [
    { genre: 'Drama', percent: 82 },
    { genre: 'Romance', percent: 74 }
  ],
  recentActivity: [
    { activityId: 'a1', uid: 'u1', displayName: 'Rohan', type: 'watched' as const, movieId: 'm1', movieTitle: 'Hereditary', moviePoster: null, createdAt: '2026-01-01T00:00:00.000Z' }
  ],
  tasteMatchScore: 87
}

afterEach(() => {
  getUserProfile.mockReset()
  followUser.mockReset()
  unfollowUser.mockReset()
  getNotifications.mockClear()
  getMe.mockClear()
})

// Seeds two history entries so the "Back" button's navigate(-1) has
// somewhere real to go — a bare single-entry history can't go back further.
function renderWithRouter(uid = 'u1') {
  return render(
    <MemoryRouter initialEntries={['/', `/profile/${uid}`]} initialIndex={1}>
      <Routes>
        <Route path="/" element={<p>Previous page</p>} />
        <Route path="/profile/:uid" element={<Profile />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Profile', () => {
  it('renders the person\'s info and follower/following counts once loaded', async () => {
    getUserProfile.mockResolvedValue(baseProfile)
    renderWithRouter()

    await waitFor(() => expect(screen.getByText('Rohan')).toBeInTheDocument())
    expect(screen.getByText('rohan.movies', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('renders the signed-in desktop shell (Sidebar + AppHeader)', async () => {
    getUserProfile.mockResolvedValue(baseProfile)
    renderWithRouter()

    await waitFor(() => expect(screen.getByText('Rohan')).toBeInTheDocument())
    expect(screen.getByText('BINJ')).toBeInTheDocument() // Sidebar's own logo mark
    await waitFor(() => expect(getMe).toHaveBeenCalled()) // AppHeader fetching its own `me`
  })

  it('shows a Connect button and follows on click', async () => {
    getUserProfile.mockResolvedValue(baseProfile)
    followUser.mockResolvedValue({ status: 'following' })
    renderWithRouter()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))

    await waitFor(() => expect(followUser).toHaveBeenCalledWith('u1'))
    expect(await screen.findByRole('button', { name: 'Following' })).toBeInTheDocument()
  })

  it('unfollows when clicking Following', async () => {
    getUserProfile.mockResolvedValue({ ...baseProfile, relationship: 'following' })
    unfollowUser.mockResolvedValue(undefined)
    renderWithRouter()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Following' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Following' }))

    await waitFor(() => expect(unfollowUser).toHaveBeenCalledWith('u1'))
    expect(await screen.findByRole('button', { name: 'Connect' })).toBeInTheDocument()
  })

  it('does not show a follow button when viewing your own profile, shows a disabled Edit Profile instead', async () => {
    getUserProfile.mockResolvedValue({ ...baseProfile, relationship: 'self', tasteMatchScore: null })
    renderWithRouter()

    await waitFor(() => expect(screen.getByText('Rohan')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /connect|following|requested/i })).not.toBeInTheDocument()
    const editButton = screen.getByRole('button', { name: /edit profile/i })
    expect(editButton).toBeDisabled()
  })

  it('lists public watched movies', async () => {
    getUserProfile.mockResolvedValue(baseProfile)
    renderWithRouter()

    expect(await screen.findByText('Interstellar')).toBeInTheDocument()
  })

  it('shows a private-list message instead of movies when watchedListVisible is false', async () => {
    getUserProfile.mockResolvedValue({ ...baseProfile, watchedListVisible: false, watched: [], recentActivity: [] })
    renderWithRouter()

    expect(await screen.findByText(/private/i)).toBeInTheDocument()
  })

  it('shows an empty-state message when the list is visible but nothing public has been watched', async () => {
    getUserProfile.mockResolvedValue({ ...baseProfile, watchedListVisible: true, watched: [] })
    renderWithRouter()

    expect(await screen.findByText(/no public watched movies/i)).toBeInTheDocument()
  })

  it('navigates back when Back is clicked', async () => {
    getUserProfile.mockResolvedValue(baseProfile)
    renderWithRouter()

    await waitFor(() => expect(screen.getByText('Rohan')).toBeInTheDocument())
    // Two Back buttons exist (mobile banner overlay + desktop row) — CSS
    // media queries hide one or the other, invisible to jsdom's layout-less
    // DOM, so either one navigating back is what matters here.
    fireEvent.click(screen.getAllByRole('button', { name: /back/i })[0])
    expect(await screen.findByText('Previous page')).toBeInTheDocument()
  })

  it('shows an error message when loading fails', async () => {
    getUserProfile.mockRejectedValue(new Error('No such user'))
    renderWithRouter('ghost')

    expect(await screen.findByRole('alert')).toHaveTextContent('No such user')
  })

  it('shows the stat row: watched, watchlist, reviews, following, followers counts', async () => {
    getUserProfile.mockResolvedValue(baseProfile)
    renderWithRouter()

    const stats = await screen.findByTestId('profile-stats')
    expect(within(stats).getByText('98')).toBeInTheDocument()
    expect(within(stats).getByText('21')).toBeInTheDocument()
    expect(within(stats).getByText('37')).toBeInTheDocument()
    expect(within(stats).getByText('8')).toBeInTheDocument()
    expect(within(stats).getByText('12')).toBeInTheDocument()
  })

  it('shows the joined date derived from joinedAt', async () => {
    getUserProfile.mockResolvedValue(baseProfile)
    renderWithRouter()

    expect(await screen.findByText(/joined/i)).toHaveTextContent('Joined Jun 2026')
  })

  it('omits the joined date when joinedAt is null', async () => {
    getUserProfile.mockResolvedValue({ ...baseProfile, joinedAt: null })
    renderWithRouter()

    await waitFor(() => expect(screen.getByText('Rohan')).toBeInTheDocument())
    expect(screen.queryByText(/joined/i)).not.toBeInTheDocument()
  })

  it('shows top genres as percentage bars', async () => {
    getUserProfile.mockResolvedValue(baseProfile)
    renderWithRouter()

    expect(await screen.findByText('Drama')).toBeInTheDocument()
    expect(screen.getByText('82%')).toBeInTheDocument()
    expect(screen.getByText('Romance')).toBeInTheDocument()
    expect(screen.getByText('74%')).toBeInTheDocument()
  })

  it('shows recent activity entries when the list is visible', async () => {
    getUserProfile.mockResolvedValue(baseProfile)
    renderWithRouter()

    expect(await screen.findByText(/Hereditary/)).toBeInTheDocument()
  })

  it('shows a taste-match card with the caller\'s score when viewing someone else', async () => {
    getUserProfile.mockResolvedValue(baseProfile)
    renderWithRouter()

    expect(await screen.findByText(/taste match/i)).toBeInTheDocument()
    expect(screen.getByText('87%')).toBeInTheDocument()
  })

  it('omits the taste-match card when no score has been computed for this pair', async () => {
    getUserProfile.mockResolvedValue({ ...baseProfile, tasteMatchScore: null })
    renderWithRouter()

    await waitFor(() => expect(screen.getByText('Rohan')).toBeInTheDocument())
    expect(screen.queryByText(/taste match/i)).not.toBeInTheDocument()
  })

  it('shows Overview as the active tab alongside the not-yet-built tabs', async () => {
    getUserProfile.mockResolvedValue(baseProfile)
    renderWithRouter()

    await waitFor(() => expect(screen.getByText('Rohan')).toBeInTheDocument())
    expect(screen.getByRole('tab', { name: 'Overview', selected: true })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Watched' })).toHaveAttribute('title', 'Coming soon')
  })
})
