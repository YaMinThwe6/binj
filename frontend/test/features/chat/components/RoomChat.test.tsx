import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const sendMessage = vi.fn()
const deleteMessage = vi.fn()
const subscribeToMessages = vi.fn()
const unsubscribe = vi.fn()
const reportContent = vi.fn()

vi.mock('../../../../src/features/chat/services/roomApi', () => ({ sendMessage, deleteMessage, subscribeToMessages }))
vi.mock('../../../../src/lib/api', () => ({ reportContent }))

const { RoomChat } = await import('../../../../src/features/chat/components/RoomChat')

const messages = [
  { messageId: 'm1', authorId: 'uid-1', text: 'Hey everyone!', createdAt: '2026-01-01T20:00:00.000Z', editedAt: null, deleted: false },
  { messageId: 'm2', authorId: 'uid-2', text: 'On my way', createdAt: '2026-01-01T20:01:00.000Z', editedAt: null, deleted: false },
  { messageId: 'm3', authorId: 'uid-2', text: 'this got removed', createdAt: '2026-01-01T20:02:00.000Z', editedAt: null, deleted: true }
]

afterEach(() => {
  sendMessage.mockReset()
  deleteMessage.mockReset()
  subscribeToMessages.mockReset()
  unsubscribe.mockReset()
  reportContent.mockReset()
})

function mockSubscription(msgs: typeof messages) {
  subscribeToMessages.mockImplementation((_roomId: string, onMessages: (m: typeof messages) => void) => {
    onMessages(msgs)
    return unsubscribe
  })
}

describe('RoomChat', () => {
  it('subscribes to the room on mount and renders non-deleted messages', () => {
    mockSubscription(messages)
    render(<RoomChat roomId="room-1" currentUid="uid-1" onBack={vi.fn()} />)

    expect(subscribeToMessages).toHaveBeenCalledWith('room-1', expect.any(Function))
    expect(screen.getByText('Hey everyone!')).toBeInTheDocument()
    expect(screen.getByText('On my way')).toBeInTheDocument()
    expect(screen.queryByText('this got removed')).not.toBeInTheDocument()
  })

  it('unsubscribes on unmount', () => {
    mockSubscription(messages)
    const { unmount } = render(<RoomChat roomId="room-1" currentUid="uid-1" onBack={vi.fn()} />)
    unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })

  it('re-subscribes when roomId changes', () => {
    mockSubscription(messages)
    const { rerender } = render(<RoomChat roomId="room-1" currentUid="uid-1" onBack={vi.fn()} />)
    rerender(<RoomChat roomId="room-2" currentUid="uid-1" onBack={vi.fn()} />)

    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(subscribeToMessages).toHaveBeenCalledWith('room-2', expect.any(Function))
  })

  it('sends a message and clears the draft', async () => {
    mockSubscription(messages)
    sendMessage.mockResolvedValue({ messageId: 'm4', createdAt: '2026-01-01T20:03:00.000Z' })
    render(<RoomChat roomId="room-1" currentUid="uid-1" onBack={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Starting now!' } })
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }))

    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('room-1', 'Starting now!'))
    expect(screen.getByLabelText(/message/i)).toHaveValue('')
  })

  it('shows an error and keeps the draft when sending fails', async () => {
    mockSubscription(messages)
    sendMessage.mockRejectedValue(new Error('network error'))
    render(<RoomChat roomId="room-1" currentUid="uid-1" onBack={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'oops' } })
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('network error'))
    expect(screen.getByLabelText(/message/i)).toHaveValue('oops')
  })

  it('only offers Delete on the caller\'s own messages', () => {
    mockSubscription(messages)
    render(<RoomChat roomId="room-1" currentUid="uid-1" onBack={vi.fn()} />)

    expect(screen.getAllByRole('button', { name: /delete/i })).toHaveLength(1) // only m1, authored by uid-1
  })

  it('deletes a message on click', async () => {
    mockSubscription(messages)
    deleteMessage.mockResolvedValue(undefined)
    render(<RoomChat roomId="room-1" currentUid="uid-1" onBack={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    await waitFor(() => expect(deleteMessage).toHaveBeenCalledWith('room-1', 'm1'))
  })

  it('calls onBack when Back is clicked', () => {
    mockSubscription(messages)
    const onBack = vi.fn()
    render(<RoomChat roomId="room-1" currentUid="uid-1" onBack={onBack} />)

    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalled()
  })

  it('only offers Report on other people\'s messages, not the caller\'s own', () => {
    mockSubscription(messages)
    render(<RoomChat roomId="room-1" currentUid="uid-1" onBack={vi.fn()} />)

    expect(screen.getAllByRole('button', { name: /^report$/i })).toHaveLength(1) // only m2, authored by uid-2
  })

  it('opens a reason form on Report, and submits it to reportContent', async () => {
    mockSubscription(messages)
    reportContent.mockResolvedValue({
      reportId: 'rep-1',
      status: 'actioned',
      decision: {
        violates: true,
        category: 'harassment',
        contentAction: 'remove',
        accountAction: 'warn',
        suspensionDays: null,
        confidence: 0.8,
        rationale: 'This was harassment.',
        flaggedForReview: false,
        resolvedAt: '2026-01-01T20:05:00.000Z'
      }
    })
    render(<RoomChat roomId="room-1" currentUid="uid-1" onBack={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /^report$/i }))
    fireEvent.change(screen.getByLabelText(/why are you reporting/i), { target: { value: 'being rude' } })
    fireEvent.click(screen.getByRole('button', { name: /submit report/i }))

    await waitFor(() =>
      expect(reportContent).toHaveBeenCalledWith({ targetType: 'message', targetId: 'm2', roomId: 'room-1', reason: 'being rude' })
    )
    expect(await screen.findByText(/action taken/i)).toHaveTextContent('This was harassment.')
    expect(screen.queryByLabelText(/why are you reporting/i)).not.toBeInTheDocument()
  })

  it('mentions when a decision was low-confidence and flagged for human review', async () => {
    mockSubscription(messages)
    reportContent.mockResolvedValue({
      reportId: 'rep-2',
      status: 'dismissed',
      decision: {
        violates: false,
        category: 'legitimate-discussion',
        contentAction: 'none',
        accountAction: 'none',
        suspensionDays: null,
        confidence: 0.3,
        rationale: 'Unclear.',
        flaggedForReview: true,
        resolvedAt: '2026-01-01T20:05:00.000Z'
      }
    })
    render(<RoomChat roomId="room-1" currentUid="uid-1" onBack={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /^report$/i }))
    fireEvent.change(screen.getByLabelText(/why are you reporting/i), { target: { value: 'not sure' } })
    fireEvent.click(screen.getByRole('button', { name: /submit report/i }))

    expect(await screen.findByText(/flagged for human review/i)).toBeInTheDocument()
  })

  it('closes the report form on Cancel without submitting', () => {
    mockSubscription(messages)
    render(<RoomChat roomId="room-1" currentUid="uid-1" onBack={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /^report$/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.queryByLabelText(/why are you reporting/i)).not.toBeInTheDocument()
    expect(reportContent).not.toHaveBeenCalled()
  })
})
