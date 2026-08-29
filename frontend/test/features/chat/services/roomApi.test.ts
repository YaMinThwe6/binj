import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('../../../../src/lib/firebase', () => ({
  auth: { currentUser: { getIdToken: vi.fn().mockResolvedValue('fake-id-token') } },
  firestore: {}
}))

const { sendMessage, editMessage, deleteMessage, promoteRoom, scheduleEventFromRoom } = await import(
  '../../../../src/features/chat/services/roomApi'
)

const originalFetch = globalThis.fetch

function envelope(data: unknown) {
  return { success: true, message: 'OK', statusCode: 200, data }
}

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('sendMessage', () => {
  it('POSTs the text and returns messageId + createdAt', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => envelope({ messageId: 'm1', createdAt: '2026-01-01T00:00:00.000Z' })
    }) as unknown as typeof fetch

    const result = await sendMessage('room-1', 'hello')

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rooms/room-1/messages'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ text: 'hello' }) })
    )
    expect(result).toEqual({ messageId: 'm1', createdAt: '2026-01-01T00:00:00.000Z' })
  })

  it('throws with the server error message when the request fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ success: false, message: "You're not a member of this room", code: 'FORBIDDEN', statusCode: 403 })
    }) as unknown as typeof fetch

    await expect(sendMessage('room-1', 'hello')).rejects.toThrow("You're not a member of this room")
  })
})

describe('editMessage', () => {
  it('PATCHes the message text', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => envelope({}) }) as unknown as typeof fetch

    await editMessage('room-1', 'm1', 'fixed')

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rooms/room-1/messages/m1'),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ text: 'fixed' }) })
    )
  })
})

describe('deleteMessage', () => {
  it('DELETEs the message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => undefined }) as unknown as typeof fetch

    await deleteMessage('room-1', 'm1')

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rooms/room-1/messages/m1'),
      expect.objectContaining({ method: 'DELETE' })
    )
  })
})

describe('promoteRoom', () => {
  it('PATCHes the room to persistent', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => envelope({}) }) as unknown as typeof fetch

    await promoteRoom('room-1')

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rooms/room-1'),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ type: 'persistent' }) })
    )
  })
})

describe('scheduleEventFromRoom', () => {
  it('POSTs the event body and returns the new eventId', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => envelope({ eventId: 'evt-2' })
    }) as unknown as typeof fetch

    const body = {
      movieId: 'movie-1',
      datetime: '2099-01-01T20:00:00.000Z',
      mode: 'online' as const,
      visibility: 'private' as const,
      participantLimit: 5,
      requiresApproval: false
    }
    const result = await scheduleEventFromRoom('room-1', body)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rooms/room-1/events'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(body) })
    )
    expect(result).toEqual({ eventId: 'evt-2' })
  })
})
