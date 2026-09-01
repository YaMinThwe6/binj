import { useEffect, useState } from 'react'
import type { Me } from '../../../lib/api'
import { getNotifications } from '../services/homeApi'
import { GreetingHero } from './GreetingHero'
import { TopPicks } from './TopPicks'
import { PeopleYouMightVibeWith } from './PeopleYouMightVibeWith'
import { UpcomingEvents } from './UpcomingEvents'
import { NearbyEvents } from './NearbyEvents'
import { FriendsAreWatching } from './FriendsAreWatching'
import { RoomChat } from '../../chat/components/RoomChat'
import { Profile } from '../../profile/components/Profile'
import { Sidebar } from './Sidebar'

interface Props {
  me: Me
  onSignOut: () => void
  onNavigateSearch: () => void
}

export function Home({ me, onSignOut, onNavigateSearch }: Props) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [openRoomId, setOpenRoomId] = useState<string | null>(null)
  const [openProfileUid, setOpenProfileUid] = useState<string | null>(null)

  useEffect(() => {
    getNotifications(true)
      .then((res) => setUnreadCount(res.items.length))
      .catch(() => setUnreadCount(0))
  }, [])

  if (openRoomId) {
    return <RoomChat roomId={openRoomId} currentUid={me.uid} onBack={() => setOpenRoomId(null)} />
  }

  if (openProfileUid) {
    return <Profile uid={openProfileUid} onBack={() => setOpenProfileUid(null)} />
  }

  const initial = (me.displayName || me.email || '?').charAt(0).toUpperCase()

  return (
    <div className="flex min-h-svh bg-bg text-text">
      {/* Desktop-only left nav (design canvas's HomeDesktop.dc.html) — the
          mobile bottom nav below still owns navigation under lg. */}
      <Sidebar onNavigateSearch={onNavigateSearch} />

      <main className="min-w-0 flex-1 pb-6 lg:flex lg:flex-col lg:pb-0">
        <header className="flex items-center justify-between px-5 pt-4.5 lg:border-b lg:border-border-soft lg:px-7 lg:py-4.5">
          <span className="font-serif text-[22px] font-bold text-accent lg:hidden">BINJ</span>

          <button
            type="button"
            onClick={onNavigateSearch}
            className="hidden max-w-[420px] flex-1 items-center gap-2 rounded-[10px] border border-border-soft bg-surface-alt px-3.5 py-2.5 text-left lg:flex"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-faint" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <span className="text-[12.5px] text-text-faint">Search movies, people, genres…</span>
          </button>

          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={onNavigateSearch}
              aria-label="Search"
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border-soft bg-surface-alt lg:hidden"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </button>
            <button
              type="button"
              aria-label={`${unreadCount} unread notifications`}
              className="relative flex h-9 w-9 items-center justify-center rounded-[10px] border border-border-soft bg-surface-alt"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary" aria-hidden="true">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent px-1 text-[9.5px] font-bold text-bg">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(var(--accent-rgb),0.35)] bg-[rgba(var(--accent-rgb),0.16)] text-[13px] font-bold text-accent">
              {initial}
            </div>
            <span className="hidden text-[13px] font-semibold text-text lg:inline">{me.displayName}</span>
            <button type="button" onClick={onSignOut} className="text-[12.5px] font-semibold text-text-muted">
              Sign out
            </button>
          </div>
        </header>

        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <div className="flex flex-col gap-7 pt-4 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8 lg:px-7 lg:pt-7 lg:pb-10">
            <div className="flex flex-col gap-7 lg:col-start-1 lg:gap-8">
              <GreetingHero displayName={me.displayName} />
              <TopPicks />
              <UpcomingEvents onOpenChat={setOpenRoomId} />
              <NearbyEvents onOpenChat={setOpenRoomId} />
              <FriendsAreWatching onOpenProfile={setOpenProfileUid} />
            </div>
            <div className="lg:col-start-2 lg:row-start-1">
              <PeopleYouMightVibeWith onOpenProfile={setOpenProfileUid} />
            </div>
          </div>
        </div>

        <nav className="mt-7 flex items-center justify-around border-t border-border-soft px-2 pt-5 lg:hidden">
          <span className="flex flex-col items-center gap-1 text-[10px] font-bold text-accent">Home</span>
          <button type="button" onClick={onNavigateSearch} className="flex flex-col items-center gap-1 text-[10px] font-semibold text-text-muted">
            Search
          </button>
          <span className="flex flex-col items-center gap-1 text-[10px] font-semibold text-text-faint" title="Coming soon">
            Events
          </span>
          <span className="flex flex-col items-center gap-1 text-[10px] font-semibold text-text-faint" title="Coming soon">
            People
          </span>
          <span className="flex flex-col items-center gap-1 text-[10px] font-semibold text-text-faint" title="Coming soon">
            Inbox
          </span>
        </nav>
      </main>
    </div>
  )
}
