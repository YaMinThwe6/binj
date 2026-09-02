import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const getUserProfile = vi.fn()
const followUser = vi.fn()
const unfollowUser = vi.fn()

vi.mock('../../../../src/features/profile/services/profileApi', () => ({ getUserProfile }))
vi.mock('../../../../src/features/home/services/homeApi', () => ({ followUser, unfollowUser }))

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
  watched: [
    { movieId: 'm1', title: 'Interstellar', poster: null, watchedAt: '2026-01-01T00:00:00.000Z' }
  ]
}

afterEach(() => {
  getUserProfile.mockReset()
  followUser.mockReset()
  unfollowUser.mockReset()
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
    expect(screen.getByText(/12/)).toBeInTheDocument()
    expect(screen.getByText(/8/)).toBeInTheDocument()
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

  it('does not show a follow button when viewing your own profile', async () => {
    getUserProfile.mockResolvedValue({ ...baseProfile, relationship: 'self' })
    renderWithRouter()

    await waitFor(() => expect(screen.getByText('Rohan')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /connect|following|requested/i })).not.toBeInTheDocument()
  })

  it('lists public watched movies', async () => {
    getUserProfile.mockResolvedValue(baseProfile)
    renderWithRouter()

    expect(await screen.findByText('Interstellar')).toBeInTheDocument()
  })

  it('shows a private-list message instead of movies when watchedListVisible is false', async () => {
    getUserProfile.mockResolvedValue({ ...baseProfile, watchedListVisible: false, watched: [] })
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
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(await screen.findByText('Previous page')).toBeInTheDocument()
  })

  it('shows an error message when loading fails', async () => {
    getUserProfile.mockRejectedValue(new Error('No such user'))
    renderWithRouter('ghost')

    expect(await screen.findByRole('alert')).toHaveTextContent('No such user')
  })
})
