import { describe, it, expect, vi, afterEach } from 'vitest'
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const signInWithGoogle = vi.fn()
const signInWithMicrosoft = vi.fn()
const signInWithToken = vi.fn()

vi.mock('../../../../src/lib/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signInWithGoogle,
    signInWithMicrosoft,
    signInWithToken,
    signOutUser: vi.fn()
  })
}))

const { Welcome } = await import('../../../../src/features/auth/components/Welcome')

// Welcome now navigates for real between its own sub-routes (splash ->
// /get-started/signup or /login -> /get-started/verify), not just internal
// state — registers the same four paths App.tsx does, all pointing at the
// same <Welcome /> component instance, matching how it's actually reached.
function render() {
  return rtlRender(
    <MemoryRouter initialEntries={['/get-started']}>
      <Routes>
        <Route path="/get-started" element={<Welcome />} />
        <Route path="/get-started/signup" element={<Welcome />} />
        <Route path="/get-started/login" element={<Welcome />} />
        <Route path="/get-started/verify" element={<Welcome />} />
        <Route path="/" element={<p>Discover page</p>} />
      </Routes>
    </MemoryRouter>
  )
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
  signInWithGoogle.mockClear()
  signInWithMicrosoft.mockClear()
  signInWithToken.mockClear()
})

describe('Welcome — splash', () => {
  it('shows the logo, tagline, Get Started, and a Log in link', () => {
    render()
    // Mobile and desktop each render their own copy of the wordmark/tagline,
    // toggled by CSS breakpoint (md:hidden / hidden md:block) — both exist in
    // the DOM regardless of viewport since jsdom doesn't evaluate media
    // queries, so at least one match is what a real viewport would show.
    expect(screen.getAllByText('BINJ').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/find your movie/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /^get started$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /already have an account/i })).toBeInTheDocument()
  })

  it('opens the sign-in form with signup framing when Get Started is clicked', () => {
    render()
    fireEvent.click(screen.getByRole('button', { name: /^get started$/i }))
    expect(screen.getByText(/create your account/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
  })

  it('opens the same sign-in form with login framing when "Log in" is clicked', () => {
    render()
    fireEvent.click(screen.getByRole('button', { name: /already have an account/i }))
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
  })
})

describe('Welcome — per-stage URLs', () => {
  it('Back from the signup form returns to the splash', () => {
    render()
    fireEvent.click(screen.getByRole('button', { name: /^get started$/i }))
    expect(screen.getByText(/create your account/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect(screen.getByRole('button', { name: /^get started$/i })).toBeInTheDocument()
    expect(screen.queryByText(/create your account/i)).not.toBeInTheDocument()
  })

  it('Back from verify returns to the form it came from, framing intact', async () => {
    globalThis.fetch = vi.fn((url: string) => {
      if (url.includes('/auth/email/start')) {
        return Promise.resolve({ ok: true, status: 204, json: async () => undefined })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    render()
    fireEvent.click(screen.getByRole('button', { name: /already have an account/i })) // login framing
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'a@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send me a code/i }))

    await waitFor(() => expect(screen.getByText(/check your email/i)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }))

    expect(screen.getByText(/welcome back/i)).toBeInTheDocument() // still login framing, not reset to signup
  })

  it('a direct load of /get-started/verify with an email in the URL shows it and can resend', async () => {
    globalThis.fetch = vi.fn((url: string) => {
      if (url.includes('/auth/email/start')) {
        return Promise.resolve({ ok: true, status: 204, json: async () => undefined })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    rtlRender(
      <MemoryRouter initialEntries={['/get-started/verify?email=a%40example.com&intent=login']}>
        <Routes>
          <Route path="/get-started/verify" element={<Welcome />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('a@example.com')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /resend code/i }))
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/email/start'),
        expect.objectContaining({ body: JSON.stringify({ email: 'a@example.com' }) })
      )
    )
  })
})

describe('Welcome — OAuth providers', () => {
  it('calls signInWithGoogle when "Continue with Google" is clicked', () => {
    render()
    fireEvent.click(screen.getByRole('button', { name: /^get started$/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))
    expect(signInWithGoogle).toHaveBeenCalledTimes(1)
  })

  it('calls signInWithMicrosoft when "Continue with Microsoft" is clicked', () => {
    render()
    fireEvent.click(screen.getByRole('button', { name: /^get started$/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue with microsoft/i }))
    expect(signInWithMicrosoft).toHaveBeenCalledTimes(1)
  })
})

describe('Welcome — Email + OTP flow', () => {
  it('walks through send-code then verify-code, then signs in with the returned custom token', async () => {
    globalThis.fetch = vi.fn((url: string) => {
      if (url.includes('/auth/email/start')) {
        return Promise.resolve({ ok: true, status: 204, json: async () => undefined })
      }
      if (url.includes('/auth/email/verify')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, message: 'OK', statusCode: 200, data: { customToken: 'fake-custom-token' } }),
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    render()
    fireEvent.click(screen.getByRole('button', { name: /^get started$/i }))

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'a@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send me a code/i }))

    await waitFor(() =>
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument()
    )
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/email/start'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'a@example.com' }) })
    )

    fireEvent.change(screen.getByLabelText(/verification code/i), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByRole('button', { name: /verify & continue/i }))

    await waitFor(() => expect(signInWithToken).toHaveBeenCalledWith('fake-custom-token'))
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/email/verify'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'a@example.com', code: '123456' }) })
    )
  })

  it('shows an error message when verification fails', async () => {
    globalThis.fetch = vi.fn((url: string) => {
      if (url.includes('/auth/email/start')) {
        return Promise.resolve({ ok: true, status: 204, json: async () => undefined })
      }
      if (url.includes('/auth/email/verify')) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ success: false, message: 'Incorrect code', code: 'INVALID_CODE', statusCode: 400 }),
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    render()
    fireEvent.click(screen.getByRole('button', { name: /^get started$/i }))

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'a@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send me a code/i }))

    await waitFor(() => screen.getByLabelText(/verification code/i))
    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: /verify & continue/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Incorrect code'))
    expect(signInWithToken).not.toHaveBeenCalled()
  })
})
