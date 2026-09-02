import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const getTasteMatches = vi.fn()
const followUser = vi.fn()
const unfollowUser = vi.fn()
vi.mock('../../../../src/features/home/services/homeApi', () => ({ getTasteMatches, followUser, unfollowUser }))

const { PeopleYouMightVibeWith } = await import('../../../../src/features/home/components/PeopleYouMightVibeWith')

afterEach(() => {
  getTasteMatches.mockReset()
  followUser.mockReset()
  unfollowUser.mockReset()
})

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<PeopleYouMightVibeWith />} />
        <Route path="/profile/:uid" element={<p>Profile page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('PeopleYouMightVibeWith', () => {
  it('renders each person with a Connect button reflecting their relationship', async () => {
    getTasteMatches.mockResolvedValue({
      items: [
        { uid: 'u1', displayName: 'Rohan', score: 84, relationship: 'none' },
        { uid: 'u2', displayName: 'Meera', score: 81, relationship: 'following' },
        { uid: 'u3', displayName: 'Kabir', score: 79, relationship: 'pending' }
      ]
    })
    renderWithRouter()

    // Mobile and desktop each render their own copy of the name/score,
    // toggled by CSS breakpoint — both exist in jsdom regardless of viewport.
    await waitFor(() => expect(screen.getAllByText('Rohan').length).toBeGreaterThan(0))
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Following' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Requested' })).toBeInTheDocument()
  })

  it('clicking Connect on a non-followed person calls followUser and updates the label', async () => {
    getTasteMatches.mockResolvedValue({ items: [{ uid: 'u1', displayName: 'Rohan', score: 84, relationship: 'none' }] })
    followUser.mockResolvedValue({ status: 'following' })
    renderWithRouter()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))

    await waitFor(() => expect(followUser).toHaveBeenCalledWith('u1'))
    expect(await screen.findByRole('button', { name: 'Following' })).toBeInTheDocument()
  })

  it('clicking Following unfollows and reverts to Connect', async () => {
    getTasteMatches.mockResolvedValue({ items: [{ uid: 'u1', displayName: 'Rohan', score: 84, relationship: 'following' }] })
    unfollowUser.mockResolvedValue(undefined)
    renderWithRouter()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Following' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Following' }))

    await waitFor(() => expect(unfollowUser).toHaveBeenCalledWith('u1'))
    expect(await screen.findByRole('button', { name: 'Connect' })).toBeInTheDocument()
  })

  it('opens the profile when a person\'s name is clicked, without triggering Connect', async () => {
    getTasteMatches.mockResolvedValue({ items: [{ uid: 'u1', displayName: 'Rohan', score: 84, relationship: 'none' }] })
    renderWithRouter()

    await waitFor(() => expect(screen.getAllByText('Rohan').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Rohan')[0])
    expect(await screen.findByText('Profile page')).toBeInTheDocument()
    expect(followUser).not.toHaveBeenCalled()
  })
})
