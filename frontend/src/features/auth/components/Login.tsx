import { useState } from 'react'
import { useAuth } from '../../../lib/AuthContext'
import { startEmailAuth, verifyEmailAuth } from '../services/authApi'

type Stage = 'form' | 'verify'

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

export function Login() {
  const { signInWithGoogle, signInWithMicrosoft, signInWithToken } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState<Stage>('form')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')

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

  return (
    <main className="flex min-h-svh flex-1 flex-col bg-bg text-text">
      {stage === 'form' && (
        <div className="flex flex-1 flex-col px-7 pt-9 pb-10">
          <span className="font-serif text-[22px] font-bold text-accent">BINJ</span>
          <h1 className="mt-[22px] font-serif text-[26px] font-semibold text-white">Welcome back</h1>
          <p className="mt-2 mb-8 text-[13.5px] text-text-muted">Log in to keep the watchlist going.</p>

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
        </div>
      )}

      {stage === 'verify' && (
        <form onSubmit={handleVerifyCode} className="flex flex-1 flex-col px-7 pt-9 pb-10">
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
    </main>
  )
}
