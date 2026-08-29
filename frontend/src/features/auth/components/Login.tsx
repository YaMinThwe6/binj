import { useState } from 'react'
import { useAuth } from '../../../lib/AuthContext'
import { startEmailAuth, verifyEmailAuth } from '../services/authApi'

type EmailStage = 'closed' | 'enter' | 'verify'

export function Login() {
  const { signInWithGoogle, signInWithMicrosoft, signInWithToken } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailStage, setEmailStage] = useState<EmailStage>('closed')
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

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setError('')
    setLoading(true)
    try {
      await startEmailAuth(email.trim())
      setEmailStage('verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code')
    } finally {
      setLoading(false)
    }
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
    <main className="login">
      <h1>BINJ</h1>
      <p>Find your movie. Find your people.</p>

      {emailStage === 'closed' && (
        <>
          <button type="button" onClick={() => handleProviderSignIn(signInWithGoogle)} disabled={loading}>
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>
          <button type="button" onClick={() => handleProviderSignIn(signInWithMicrosoft)} disabled={loading}>
            {loading ? 'Signing in…' : 'Continue with Microsoft'}
          </button>
          <button type="button" onClick={() => setEmailStage('enter')}>
            Continue with Email
          </button>
        </>
      )}

      {emailStage === 'enter' && (
        <form onSubmit={handleSendCode}>
          <label htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Sending…' : 'Send code'}
          </button>
          <button type="button" onClick={() => setEmailStage('closed')}>
            Back
          </button>
        </form>
      )}

      {emailStage === 'verify' && (
        <form onSubmit={handleVerifyCode}>
          <p>We sent a 6-digit code to {email}</p>
          <label htmlFor="login-code">Verification code</label>
          <input
            id="login-code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            autoFocus
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Verifying…' : 'Verify & continue'}
          </button>
          <button type="button" onClick={() => setEmailStage('enter')}>
            Back
          </button>
        </form>
      )}

      {error && <p role="alert">{error}</p>}
    </main>
  )
}
