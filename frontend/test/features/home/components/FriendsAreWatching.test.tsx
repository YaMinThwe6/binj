import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const getHomeActivity = vi.fn()
vi.mock('../../../../src/features/home/services/homeApi', () => ({ getHomeActivity }))

const { FriendsAreWatching } = await import('../../../../src/features/home/components/FriendsAreWatching')

afterEach(() => getHomeActivity.mockReset())

describe('FriendsAreWatching', () => {
  it('renders nothing when there is no activity', async () => {
    getHomeActivity.mockResolvedValue({ items: [] })
    const { container } = render(<FriendsAreWatching />)
    await waitFor(() => expect(getHomeActivity).toHaveBeenCalled())
    expect(container.querySelector('.home-section')).toBeNull()
  })

  it('renders each activity item with who + what + movie', async () => {
    getHomeActivity.mockResolvedValue({
      items: [
        { activityId: 'a1', uid: 'u1', displayName: 'Rohan', type: 'watched', movieId: 'm1', movieTitle: 'Dune: Part Two', moviePoster: null, createdAt: new Date().toISOString() }
      ]
    })
    render(<FriendsAreWatching />)

    await waitFor(() => expect(screen.getByText(/Rohan watched/)).toBeInTheDocument())
    expect(screen.getByText('Dune: Part Two')).toBeInTheDocument()
  })
})
