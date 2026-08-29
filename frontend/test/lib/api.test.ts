import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('../../src/lib/firebase', () => ({
  auth: { currentUser: null },
  googleProvider: {}
}))

const { getMe, updateMe } = await import('../../src/lib/api')
const mockAuth = (await import('../../src/lib/firebase')).auth as unknown as { currentUser: { getIdToken: () => Promise<string> } | null }

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
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
      status: 200,
      json: async () => ({ success: true, message: 'OK', statusCode: 200, data: me }),
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

  it('throws with the server error message when the request fails', async () => {
    mockAuth.currentUser = { getIdToken: vi.fn().mockResolvedValue('fake-id-token') } as never
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ success: false, message: 'Firestore is not configured', code: 'FIRESTORE_NOT_CONFIGURED', statusCode: 503 }),
    }) as unknown as typeof fetch

    await expect(getMe()).rejects.toThrow('Firestore is not configured')
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
      status: 200,
      json: async () => ({ success: true, message: 'OK', statusCode: 200, data: { accentTheme: 'pink' } }),
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
