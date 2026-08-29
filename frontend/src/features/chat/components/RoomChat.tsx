import { useEffect, useState } from 'react'
import { sendMessage, deleteMessage, subscribeToMessages, type RoomMessage } from '../services/roomApi'

interface Props {
  roomId: string
  currentUid: string
  onBack: () => void
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// hld.md §16 — messages arrive in real time via subscribeToMessages'
// Firestore onSnapshot listener, not polling; sending/deleting still goes
// through the backend (write path stays validated server-side).
export function RoomChat({ roomId, currentUid, onBack }: Props) {
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    setConnected(false)
    const unsubscribe = subscribeToMessages(roomId, (msgs) => {
      setMessages(msgs)
      setConnected(true)
    })
    return unsubscribe
  }, [roomId])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setSending(true)
    setError('')
    try {
      await sendMessage(roomId, text)
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(messageId: string) {
    try {
      await deleteMessage(roomId, messageId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete message')
    }
  }

  const visibleMessages = messages.filter((m) => !m.deleted)

  return (
    <main className="room-chat">
      <header>
        <button type="button" onClick={onBack}>← Back</button>
        <h1>Room chat</h1>
      </header>

      {!connected && <p>Connecting…</p>}
      {error && <p role="alert">{error}</p>}

      <ul className="message-list">
        {visibleMessages.map((m) => (
          <li key={m.messageId} className={m.authorId === currentUid ? 'message mine' : 'message'}>
            <span className="message-text">{m.text}</span>
            <span className="message-time">{formatTime(m.createdAt)}{m.editedAt ? ' (edited)' : ''}</span>
            {m.authorId === currentUid && (
              <button type="button" onClick={() => handleDelete(m.messageId)}>Delete</button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={handleSend} className="message-form">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message…"
          aria-label="Message"
        />
        <button type="submit" disabled={sending || draft.trim().length === 0}>Send</button>
      </form>
    </main>
  )
}
