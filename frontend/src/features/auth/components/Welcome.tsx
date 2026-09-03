import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../lib/AuthContext'
import { startEmailAuth, verifyEmailAuth } from '../services/authApi'

type Stage = 'welcome' | 'form' | 'verify'
// Purely a copy switch (heading/tagline) — "Get Started" and "Log in" hit
// the exact same sign-in mechanism underneath. There's no separate signup
// call: the backend creates a BINJ profile lazily on a brand-new user's
// first authenticated request (hld.md §13), so a first-time Google/
// Microsoft/email sign-in already *is* account creation, whichever button
// got them here.
type Intent = 'signup' | 'login'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.7-.4-4z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3 16.3 3 9.7 7.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 45c5.2 0 9.9-1.7 13.6-4.7l-6.3-5.3C29.3 36.9 26.8 38 24 38c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 41.5 16.3 45 24 45z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.3 5.3C39.9 36.8 44 32 44 24c0-1.4-.1-2.7-.4-3.5z" />
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F35325" />
      <rect x="11" y="1" width="9" height="9" fill="#81BC06" />
      <rect x="1" y="11" width="9" height="9" fill="#05A6F0" />
      <rect x="11" y="11" width="9" height="9" fill="#FFBA08" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6E6A78" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  )
}

// hld.md §13 — the combined login/signup entry point (was two separate
// ideas crammed under "Login"; renamed since one screen genuinely serves
// both). Three stages: the Get-Started splash (design canvas's
// Welcome.dc.html), the Google/Microsoft/email chooser (Login.dc.html),
// and OTP verification (SignupEmailOTP.dc.html's verify state) — all one
// component since they share the same auth handlers and only the first
// stage's copy depends on which button the visitor arrived through.
// Reached at "/get-started" — the back arrow on the splash stage always
// returns to Discover ("/"), regardless of how this URL was reached
// (clicked from Discover, typed directly, or a bookmark).
export function Welcome() {
  const navigate = useNavigate()
  const { signInWithGoogle, signInWithMicrosoft, signInWithToken } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState<Stage>('welcome')
  const [intent, setIntent] = useState<Intent>('signup')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')

  function openForm(nextIntent: Intent) {
    setIntent(nextIntent)
    setStage('form')
  }

  async function handleProviderSignIn(signIn: () => Promise<void>) {
    setError('')
    setLoading(true)
    try {
      await signIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  async function sendCode() {
    if (!email.trim()) return
    setError('')
    setLoading(true)
    try {
      await startEmailAuth(email.trim())
      setStage('verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code')
    } finally {
      setLoading(false)
    }
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    await sendCode()
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setError('')
    setLoading(true)
    try {
      const { customToken } = await verifyEmailAuth(email.trim(), code.trim())
      await signInWithToken(customToken)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code')
    } finally {
      setLoading(false)
    }
  }

  if (stage === 'welcome') {
    // Getting Started — an accent glow and a bottom fade-to-black wash over
    // the plain background (no photo — a stock/generic atmosphere shot read
    // as an artificial, template-made touch rather than something BINJ's
    // own), content anchored to the bottom. Desktop swaps the small
    // wordmark-as-heading for a fixed top-left wordmark plus a large
    // headline + subtitle, and the button gains an arrow — mobile stays
    // copy-only.
    return (
      <main className="relative flex h-svh flex-col overflow-hidden bg-bg text-text">
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0 md:hidden"
            style={{ background: 'radial-gradient(90% 55% at 75% 12%, rgba(var(--accent-rgb), 0.12), transparent 60%)' }}
          />
          <div
            className="absolute inset-0 hidden md:block"
            style={{ background: 'radial-gradient(45% 60% at 78% 10%, rgba(var(--accent-rgb), 0.10), transparent 60%)' }}
          />
          <div
            className="absolute inset-0 md:hidden"
            style={{ background: 'linear-gradient(180deg, rgba(14,13,16,0) 0%, rgba(14,13,16,0.35) 55%, #0E0D10 96%)' }}
          />
          <div
            className="absolute inset-0 hidden md:block"
            style={{
              background:
                'linear-gradient(180deg, rgba(14,13,16,0) 0%, rgba(14,13,16,0.15) 45%, rgba(14,13,16,0.55) 70%, rgba(10,9,11,0.94) 100%)'
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Back to Discover"
          className="relative z-10 mt-5 ml-6 flex h-[38px] w-[38px] items-center justify-center rounded-full border border-border-soft bg-surface-alt md:hidden"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Desktop-only: fixed top-left wordmark + a Discover-return control
            in the same spot the mobile back arrow occupies, since desktop's
            bottom content block has no wordmark of its own to double as one. */}
        <div className="absolute top-10 left-14 z-10 hidden items-center gap-4 md:flex">
          <span className="font-serif text-2xl font-bold text-accent">BINJ</span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Back to Discover"
          className="absolute top-9 right-14 z-10 hidden h-10 w-10 items-center justify-center rounded-full border border-border-soft bg-surface-alt/80 md:flex"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div className="relative z-10 mt-auto flex flex-col items-center px-8 pb-14 text-center md:px-10 md:pb-14">
          <span className="font-serif text-5xl font-bold text-accent animate-logo-pulse md:hidden">BINJ</span>
          <p className="mt-3.5 mb-10 max-w-sm text-[15px] leading-relaxed text-text-secondary md:hidden">
            Find your movie.
            <br />
            Find your people.
          </p>

          <span className="hidden font-serif text-5xl font-bold tracking-wide text-white md:block">
            Find your movie.
            <br />
            Find your people.
          </span>
          <p className="mt-4.5 mb-8 hidden max-w-[460px] text-[15px] leading-relaxed text-text-secondary md:block">
            Discover films worth watching, and the people who want to watch them with you.
          </p>

          <button
            type="button"
            onClick={() => openForm('signup')}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-sm font-bold text-bg shadow-[0_0_24px_rgba(var(--accent-rgb),0.35)] md:w-auto md:px-10 md:shadow-[0_0_28px_rgba(var(--accent-rgb),0.4)]"
          >
            Get Started
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="hidden md:block" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>

          <button type="button" onClick={() => openForm('login')} className="mt-5 text-[13px] text-text-muted md:mt-4.5 md:text-[13.5px]">
            Already have an account? <span className="font-bold text-accent">Log in</span>
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="relative flex min-h-svh flex-1 flex-col overflow-hidden bg-bg text-text">
      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col">
        {/* faint accent glow, top-right — Welcome.dc.html */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(90% 55% at 75% 12%, rgba(var(--accent-rgb), 0.16), transparent 60%)' }}
        />

        {stage === 'form' && (
          <div className="relative flex flex-1 flex-col px-7 pt-9 pb-10">
            <span className="font-serif text-[22px] font-bold text-accent">BINJ</span>
            <h1 className="mt-[22px] font-serif text-[26px] font-semibold text-white">
              {intent === 'signup' ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="mt-2 mb-8 text-[13.5px] text-text-muted">
              {intent === 'signup' ? "Choose how you'd like to sign up. No passwords to remember." : 'Log in to keep the watchlist going.'}
            </p>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => handleProviderSignIn(signInWithGoogle)}
                disabled={loading}
                className="flex items-center justify-center gap-2.5 rounded-xl bg-white py-3.5 text-sm font-bold text-[#1A1A1A] disabled:opacity-60"
              >
                <GoogleIcon />
                {loading ? 'Signing in…' : 'Continue with Google'}
              </button>
              <button
                type="button"
                onClick={() => handleProviderSignIn(signInWithMicrosoft)}
                disabled={loading}
                className="flex items-center justify-center gap-2.5 rounded-xl border border-border bg-surface-alt py-3.5 text-sm font-bold text-text disabled:opacity-60"
              >
                <MicrosoftIcon />
                {loading ? 'Signing in…' : 'Continue with Microsoft'}
              </button>
            </div>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border-soft" />
              <span className="text-[11.5px] text-text-faint">or</span>
              <div className="h-px flex-1 bg-border-soft" />
            </div>

            <form onSubmit={handleSendCode} className="flex flex-col">
              <label htmlFor="login-email" className="mb-2 text-xs font-semibold text-text-secondary">
                Email address
              </label>
              <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-border bg-surface-alt px-4 py-3.5">
                <MailIcon />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 bg-transparent text-sm text-text outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="mt-4 flex items-center justify-center rounded-xl bg-accent py-3.5 text-sm font-bold text-bg disabled:opacity-60"
              >
                {loading ? 'Sending…' : 'Send me a code'}
              </button>
            </form>

            {error && (
              <p role="alert" className="mt-4 text-[13px] text-red-400">
                {error}
              </p>
            )}

            <button type="button" onClick={() => setStage('welcome')} className="mt-6 text-center text-[13px] text-text-muted">
              Back
            </button>
          </div>
        )}

        {stage === 'verify' && (
          <form onSubmit={handleVerifyCode} className="relative flex flex-1 flex-col px-7 pt-9 pb-10">
            <h1 className="font-serif text-[26px] font-semibold text-white">Check your email</h1>
            <p className="mt-2 mb-7 text-[13.5px] text-text-muted">
              We sent a 6-digit code to <span className="font-semibold text-text-secondary">{email}</span>
            </p>

            <label htmlFor="login-code" className="sr-only">
              Verification code
            </label>
            <input
              id="login-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              autoFocus
              className="rounded-xl border border-accent bg-surface-alt py-4 text-center text-2xl font-bold tracking-[0.5em] text-text outline-none"
            />

            <div className="mt-5 text-center text-[13px] text-text-muted">
              Didn&rsquo;t get it?{' '}
              <button type="button" onClick={sendCode} className="font-bold text-accent">
                Resend code
              </button>
            </div>

            {error && (
              <p role="alert" className="mt-4 text-[13px] text-red-400">
                {error}
              </p>
            )}

            <div className="flex-1" />

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center rounded-xl bg-accent py-3.5 text-sm font-bold text-bg disabled:opacity-60"
            >
              {loading ? 'Verifying…' : 'Verify & continue'}
            </button>
            <button type="button" onClick={() => setStage('form')} className="mt-3 text-[13px] text-text-muted">
              Back
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
