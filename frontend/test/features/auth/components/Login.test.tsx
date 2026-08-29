import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

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

const { Login } = await import('../../../../src/features/auth/components/Login')

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
  signInWithGoogle.mockClear()
  signInWithMicrosoft.mockClear()
  signInWithToken.mockClear()
})

describe('Login — OAuth providers', () => {
  it('calls signInWithGoogle when "Continue with Google" is clicked', () => {
    render(<Login />)
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))
    expect(signInWithGoogle).toHaveBeenCalledTimes(1)
  })

  it('calls signInWithMicrosoft when "Continue with Microsoft" is clicked', () => {
    render(<Login />)
    fireEvent.click(screen.getByRole('button', { name: /continue with microsoft/i }))
    expect(signInWithMicrosoft).toHaveBeenCalledTimes(1)
  })
})

describe('Login — Email + OTP flow', () => {
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

    render(<Login />)

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

    render(<Login />)

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'a@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send me a code/i }))

    await waitFor(() => screen.getByLabelText(/verification code/i))
    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: /verify & continue/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Incorrect code'))
    expect(signInWithToken).not.toHaveBeenCalled()
  })
})
