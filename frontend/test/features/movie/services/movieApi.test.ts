import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('../../../../src/lib/firebase', () => ({
  auth: { currentUser: null },
  googleProvider: {}
}))

const { searchMovies, getMovie } = await import('../../../../src/features/movie/services/movieApi')

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('searchMovies', () => {
  it('calls the search endpoint with the query and returns items', async () => {
    const items = [{ movieId: '634649', title: 'Spider-Man: No Way Home', poster: null, year: 2021 }]
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, message: 'OK', statusCode: 200, data: { items } }),
    }) as unknown as typeof fetch

    const result = await searchMovies('spider-man')

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/search/movies?q=spider-man'),
      expect.objectContaining({ method: 'GET' })
    )
    expect(result).toEqual({ items })
  })
})

describe('getMovie', () => {
  it('throws with the server error message when the request fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ success: false, message: 'Failed to fetch movie details', code: 'TMDB_UPSTREAM_ERROR', statusCode: 502 }),
    }) as unknown as typeof fetch

    await expect(getMovie('1930')).rejects.toThrow('Failed to fetch movie details')
  })
})
