import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTasteMatches, followUser, unfollowUser, type TasteMatch } from '../services/homeApi'

function connectLabel(relationship: TasteMatch['relationship']): string {
  if (relationship === 'following') return 'Following'
  if (relationship === 'pending') return 'Requested'
  return 'Connect'
}

export function PeopleYouMightVibeWith() {
  const navigate = useNavigate()
  const [items, setItems] = useState<TasteMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // Home can unmount mid-fetch (e.g. navigating away right after landing) —
    // guard against setting state on an unmounted component when the
    // response lands late.
    let cancelled = false
    getTasteMatches()
      .then((res) => {
        if (!cancelled) setItems(res.items)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load matches')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function toggleConnect(uid: string) {
    const current = items.find((i) => i.uid === uid)
    if (!current) return

    if (current.relationship === 'none') {
      setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, relationship: 'pending' } : i)))
      try {
        const { status } = await followUser(uid)
        setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, relationship: status } : i)))
      } catch (err) {
        setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, relationship: 'none' } : i)))
        setError(err instanceof Error ? err.message : 'Failed to connect')
      }
    } else {
      const previous = current.relationship
      setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, relationship: 'none' } : i)))
      try {
        await unfollowUser(uid)
      } catch (err) {
        setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, relationship: previous } : i)))
        setError(err instanceof Error ? err.message : 'Failed to update')
      }
    }
  }

  if (loading)
    return (
      <section>
        <h2 className="mb-3 px-5 text-[15px] font-bold text-text lg:px-0 lg:text-[13.5px]">People you might vibe with</h2>
        <p className="px-5 text-sm text-text-muted lg:px-0">Loading…</p>
      </section>
    )
  if (error)
    return (
      <section>
        <h2 className="mb-3 px-5 text-[15px] font-bold text-text lg:px-0 lg:text-[13.5px]">People you might vibe with</h2>
        <p role="alert" className="px-5 text-sm text-red-400 lg:px-0">
          {error}
        </p>
      </section>
    )
  if (items.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 px-5 text-[15px] font-bold text-text lg:px-0 lg:text-[13.5px]">People you might vibe with</h2>
      {/* Horizontal card row below lg (main-column context); a compact
          vertical list at lg+ (right-rail context, HomeDesktop.dc.html) —
          one mount, one fetch, purely a CSS layout switch. */}
      <ul className="flex gap-3 overflow-x-auto px-5 pb-1 lg:flex-col lg:gap-3.5 lg:overflow-visible lg:px-0 lg:pb-0">
        {items.map((person) => {
          const isConnected = person.relationship !== 'none'
          return (
            <li
              key={person.uid}
              className="w-[118px] flex-none rounded-2xl border border-border-soft bg-surface p-4 text-center lg:flex lg:w-full lg:items-center lg:gap-2.5 lg:rounded-none lg:border-none lg:bg-transparent lg:p-0 lg:text-left"
            >
              <button type="button" onClick={() => navigate(`/profile/${person.uid}`)} className="flex w-full flex-col items-center lg:min-w-0 lg:flex-1 lg:flex-row lg:text-left">
                <div className="mx-auto flex h-13 w-13 items-center justify-center rounded-full border border-[rgba(124,140,166,0.32)] bg-[rgba(124,140,166,0.14)] text-[15px] font-bold text-[#9BABC4] lg:mx-0 lg:h-9.5 lg:w-9.5 lg:flex-none lg:text-[13px]">
                  {person.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="mt-2.5 text-[12.5px] font-bold text-text lg:hidden">{person.displayName}</div>
                <div className="hidden min-w-0 lg:ml-2.5 lg:block">
                  <div className="truncate text-[12.5px] font-bold text-text">{person.displayName}</div>
                  <div className="text-[10.5px] font-semibold text-accent">{person.score}% taste match</div>
                </div>
              </button>
              <div className="mt-0.5 text-[10.5px] font-bold text-accent lg:hidden">{person.score}% match</div>
              <button
                type="button"
                onClick={() => toggleConnect(person.uid)}
                className={
                  isConnected
                    ? 'mt-2.5 w-full rounded-[9px] border border-border bg-surface-alt py-1.5 text-[11px] font-bold text-text lg:mt-0 lg:w-auto lg:flex-none lg:px-3.5 lg:py-1.5'
                    : 'mt-2.5 w-full rounded-[9px] border border-accent bg-transparent py-1.5 text-[11px] font-bold text-accent lg:mt-0 lg:w-auto lg:flex-none lg:px-3.5 lg:py-1.5'
                }
              >
                {connectLabel(person.relationship)}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
