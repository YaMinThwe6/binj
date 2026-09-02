import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const getHomeActivity = vi.fn()
vi.mock('../../../../src/features/home/services/homeApi', () => ({ getHomeActivity }))

const { FriendsAreWatching } = await import('../../../../src/features/home/components/FriendsAreWatching')

afterEach(() => getHomeActivity.mockReset())

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<FriendsAreWatching />} />
        <Route path="/profile/:uid" element={<p>Profile page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('FriendsAreWatching', () => {
  it('renders nothing when there is no activity', async () => {
    getHomeActivity.mockResolvedValue({ items: [] })
    const { container } = renderWithRouter()
    await waitFor(() => expect(getHomeActivity).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('renders each activity item with who + what + movie', async () => {
    getHomeActivity.mockResolvedValue({
      items: [
        { activityId: 'a1', uid: 'u1', displayName: 'Rohan', type: 'watched', movieId: 'm1', movieTitle: 'Dune: Part Two', moviePoster: null, createdAt: new Date().toISOString() }
      ]
    })
    renderWithRouter()

    await waitFor(() => expect(screen.getByText('Rohan')).toBeInTheDocument())
    expect(screen.getByText(/watched/)).toBeInTheDocument()
    expect(screen.getByText('Dune: Part Two')).toBeInTheDocument()
  })

  it('opens the profile when the person\'s name is clicked', async () => {
    getHomeActivity.mockResolvedValue({
      items: [
        { activityId: 'a1', uid: 'u1', displayName: 'Rohan', type: 'watched', movieId: 'm1', movieTitle: 'Dune: Part Two', moviePoster: null, createdAt: new Date().toISOString() }
      ]
    })
    renderWithRouter()

    fireEvent.click(await screen.findByText('Rohan'))
    expect(await screen.findByText('Profile page')).toBeInTheDocument()
  })
})
