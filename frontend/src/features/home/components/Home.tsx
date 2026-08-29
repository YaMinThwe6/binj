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
import '../home.css'

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

  return (
    <main className="home">
      <header className="home-topbar">
        <span className="brand">BINJ</span>
        <div className="topbar-actions">
          <button type="button" onClick={onNavigateSearch}>Search</button>
          <button type="button" className="bell" aria-label={`${unreadCount} unread notifications`}>
            🔔{unreadCount > 0 && <span className="badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          <div className="avatar">{(me.displayName || me.email || '?').charAt(0).toUpperCase()}</div>
          <button type="button" onClick={onSignOut}>Sign out</button>
        </div>
      </header>

      <GreetingHero displayName={me.displayName} />
      <TopPicks />
      <PeopleYouMightVibeWith onOpenProfile={setOpenProfileUid} />
      <UpcomingEvents onOpenChat={setOpenRoomId} />
      <NearbyEvents onOpenChat={setOpenRoomId} />
      <FriendsAreWatching onOpenProfile={setOpenProfileUid} />

      <nav className="bottom-nav">
        <span className="nav-item active">Home</span>
        <button type="button" className="nav-item" onClick={onNavigateSearch}>Search</button>
        <span className="nav-item disabled" title="Coming soon">Events</span>
        <span className="nav-item disabled" title="Coming soon">People</span>
        <span className="nav-item disabled" title="Coming soon">Inbox</span>
      </nav>
    </main>
  )
}
