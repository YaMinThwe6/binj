import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from './App'

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('App search flow', () => {
  it('searches and renders results, then loads detail on selection', async () => {
    global.fetch = vi
      .fn()
      // search call
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ movieId: '634649', title: 'Spider-Man: No Way Home', poster: null, year: 2021 }],
        }),
      })
      // detail call
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          movieId: '634649',
          title: 'Spider-Man: No Way Home',
          poster: null,
          year: 2021,
          runtime: 148,
          genres: ['Action', 'Adventure'],
          synopsis: 'Peter faces multiverse consequences.',
          cast: [{ name: 'Tom Holland', character: 'Peter Parker' }],
          crew: [],
          voteAverage: 8.1,
          streamingProviders: [],
        }),
      }) as unknown as typeof fetch

    render(<App />)

    fireEvent.change(screen.getByLabelText(/search for a movie/i), {
      target: { value: 'spider-man' },
    })
    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Spider-Man: No Way Home \(2021\)/i })).toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: /Spider-Man: No Way Home \(2021\)/i }))

    await waitFor(() =>
      expect(screen.getByText(/Peter faces multiverse consequences\./i)).toBeInTheDocument()
    )
    expect(screen.getByText(/TMDB rating: 8\.1/i)).toBeInTheDocument()
  })
})
