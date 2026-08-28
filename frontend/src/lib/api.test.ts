import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('./firebase', () => ({
  auth: { currentUser: null },
  googleProvider: {}
}))

const { searchMovies, getMovie, getMe, updateMe } = await import('./api')
const mockAuth = (await import('./firebase')).auth as unknown as { currentUser: { getIdToken: () => Promise<string> } | null }

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('searchMovies', () => {
  it('calls the search endpoint with the query and returns items', async () => {
    const mockResponse = { items: [{ movieId: '634649', title: 'Spider-Man: No Way Home', poster: null, year: 2021 }] }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as unknown as typeof fetch

    const result = await searchMovies('spider-man')

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/search/movies?q=spider-man'),
      expect.objectContaining({ method: 'GET' })
    )
    expect(result).toEqual(mockResponse)
  })
})

describe('getMovie', () => {
  it('throws with the server error message when the request fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: { code: 'TMDB_UPSTREAM_ERROR', message: 'Failed to fetch movie details' } }),
    }) as unknown as typeof fetch

    await expect(getMovie('1930')).rejects.toThrow('Failed to fetch movie details')
  })
})

describe('getMe', () => {
  afterEach(() => {
    mockAuth.currentUser = null
  })

  it('throws "Not signed in" when there is no current Firebase user', async () => {
    await expect(getMe()).rejects.toThrow('Not signed in')
  })

  it('attaches the ID token as a Bearer Authorization header when signed in', async () => {
    mockAuth.currentUser = { getIdToken: vi.fn().mockResolvedValue('fake-id-token') } as never
    const me = { uid: 'uid-1', displayName: 'Arjun', email: 'a@example.com' }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => me,
    }) as unknown as typeof fetch

    const result = await getMe()

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/users/me'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer fake-id-token' })
      })
    )
    expect(result).toEqual(me)
  })
})

describe('updateMe', () => {
  afterEach(() => {
    mockAuth.currentUser = null
  })

  it('sends a PATCH with the given fields and the auth header', async () => {
    mockAuth.currentUser = { getIdToken: vi.fn().mockResolvedValue('fake-id-token') } as never
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accentTheme: 'pink' }),
    }) as unknown as typeof fetch

    await updateMe({ accentTheme: 'pink' })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/users/me'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ accentTheme: 'pink' }),
        headers: expect.objectContaining({
          Authorization: 'Bearer fake-id-token',
          'Content-Type': 'application/json'
        })
      })
    )
  })
})
