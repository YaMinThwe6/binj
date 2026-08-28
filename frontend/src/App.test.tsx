import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('./lib/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'uid-1', displayName: 'Arjun', email: 'arjun@example.com' },
    loading: false,
    signInWithGoogle: vi.fn(),
    signOutUser: vi.fn()
  })
}))

vi.mock('./lib/firebase', () => ({
  auth: { currentUser: { getIdToken: vi.fn().mockResolvedValue('fake-id-token') } },
  googleProvider: {}
}))

const { default: App } = await import('./App')

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('App search flow', () => {
  it('searches and renders results, then loads detail on selection', async () => {
    // Dispatch by URL rather than call order — the mount-time getMe() call and the
    // user-triggered search call race each other (getMe awaits getIdToken() first,
    // so it doesn't necessarily reach fetch() before the search does).
    globalThis.fetch = vi.fn((url: string) => {
      if (url.includes('/users/me')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            uid: 'uid-1',
            displayName: 'Arjun',
            email: 'arjun@example.com',
            isNewUser: false,
            onboardingComplete: true,
          }),
        })
      }
      if (url.includes('/search/movies')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [{ movieId: '634649', title: 'Spider-Man: No Way Home', poster: null, year: 2021 }],
          }),
        })
      }
      if (url.includes('/movies/634649')) {
        return Promise.resolve({
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
        })
      }
      // Home's own sections — benign empty responses, this test only cares about Search.
      if (
        url.includes('/home/greeting') ||
        url.includes('/recommendations') ||
        url.includes('/users/me/tasteMatches') ||
        url.includes('/events/upcoming') ||
        url.includes('/home/activity') ||
        url.includes('/users/me/notifications')
      ) {
        return Promise.resolve({ ok: true, json: async () => ({ items: [] }) })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    render(<App />)

    // Home is the default landing view — navigate to Search first.
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^search$/i }).length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByRole('button', { name: /^search$/i })[0])

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
