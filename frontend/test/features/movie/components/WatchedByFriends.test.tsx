import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const getMovieWatchedBy = vi.fn()
vi.mock('../../../../src/features/movie/services/movieApi', () => ({ getMovieWatchedBy }))

const { WatchedByFriends } = await import('../../../../src/features/movie/components/WatchedByFriends')

afterEach(() => getMovieWatchedBy.mockReset())

describe('WatchedByFriends', () => {
  it('renders nothing while loading', () => {
    getMovieWatchedBy.mockReturnValue(new Promise(() => {})) // never resolves
    const { container } = render(<WatchedByFriends movieId="movie-1" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when there are no qualifying watchers', async () => {
    getMovieWatchedBy.mockResolvedValue({ items: [], nextCursor: null })
    const { container } = render(<WatchedByFriends movieId="movie-1" />)
    await waitFor(() => expect(getMovieWatchedBy).toHaveBeenCalledWith('movie-1'))
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the request fails', async () => {
    getMovieWatchedBy.mockRejectedValue(new Error('boom'))
    const { container } = render(<WatchedByFriends movieId="movie-1" />)
    await waitFor(() => expect(getMovieWatchedBy).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('renders each followed watcher by display name', async () => {
    getMovieWatchedBy.mockResolvedValue({
      items: [
        { uid: 'u1', displayName: 'Rohan', watchedAt: '2026-01-01T00:00:00.000Z' },
        { uid: 'u2', displayName: 'Meera', watchedAt: '2026-01-02T00:00:00.000Z' }
      ],
      nextCursor: null
    })
    render(<WatchedByFriends movieId="movie-1" />)

    await waitFor(() => expect(screen.getByText('Rohan')).toBeInTheDocument())
    expect(screen.getByText('Meera')).toBeInTheDocument()
  })
})
