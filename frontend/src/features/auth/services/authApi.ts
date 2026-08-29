import { apiFetch } from '../../../lib/api'

export function startEmailAuth(email: string): Promise<void> {
  return apiFetch('/auth/email/start', { method: 'POST', body: { email } })
}

export function verifyEmailAuth(email: string, code: string): Promise<{ customToken: string }> {
  return apiFetch('/auth/email/verify', { method: 'POST', body: { email, code } })
}
