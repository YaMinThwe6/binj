import { useEffect, useState } from 'react'
import { getMe, type Me } from './lib/api'
import { useAuth } from './lib/AuthContext'
import { applyAccentTheme } from './lib/theme'
import { Login } from './features/auth/components/Login'
import { OnboardingWizard } from './features/onboarding/components/OnboardingWizard'
import { Home } from './features/home/components/Home'
import { MovieSearch } from './features/movie/components/MovieSearch'
import './App.css'

function App() {
  const { user, loading: authLoading, signOutUser } = useAuth()
  const [me, setMe] = useState<Me | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [view, setView] = useState<'home' | 'search'>('home')

  useEffect(() => {
    if (!user) {
      setMe(null)
      return
    }
    getMe()
      .then(setMe)
      .catch((err) => setErrorMessage(err instanceof Error ? err.message : 'Failed to load profile'))
  }, [user])

  useEffect(() => {
    applyAccentTheme(me?.accentTheme)
  }, [me?.accentTheme])

  if (authLoading) {
    return (
      <main className="app">
        <p>Loading…</p>
      </main>
    )
  }

  if (!user) {
    return <Login />
  }

  if (me && (me.isNewUser || !me.onboardingComplete)) {
    return (
      <OnboardingWizard
        initialDisplayName={me.displayName || user.displayName || ''}
        email={me.email || user.email || ''}
        onComplete={() => setMe({ ...me, onboardingComplete: true })}
      />
    )
  }

  if (errorMessage && !me) {
    return (
      <main className="app">
        <p role="alert">{errorMessage}</p>
      </main>
    )
  }

  if (!me) {
    return (
      <main className="app">
        <p>Loading…</p>
      </main>
    )
  }

  if (view === 'search') {
    return <MovieSearch onBack={() => setView('home')} />
  }

  return <Home me={me} onSignOut={() => void signOutUser()} onNavigateSearch={() => setView('search')} />
}

export default App
