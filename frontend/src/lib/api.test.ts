import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchMovies, getMovie } from './api'

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('searchMovies', () => {
  it('calls the search endpoint with the query and returns items', async () => {
    const mockResponse = { items: [{ movieId: '634649', title: 'Spider-Man: No Way Home', poster: null, year: 2021 }] }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as unknown as typeof fetch

    const result = await searchMovies('spider-man')

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/search/movies?q=spider-man')
    )
    expect(result).toEqual(mockResponse)
  })
})

describe('getMovie', () => {
  it('throws with the server error message when the request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: { code: 'TMDB_UPSTREAM_ERROR', message: 'Failed to fetch movie details' } }),
    }) as unknown as typeof fetch

    await expect(getMovie('1930')).rejects.toThrow('Failed to fetch movie details')
  })
})
