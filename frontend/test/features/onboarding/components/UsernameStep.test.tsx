import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const checkUsernameAvailable = vi.fn()
const updateMe = vi.fn()

vi.mock('../../../../src/features/onboarding/services/onboardingApi', () => ({ checkUsernameAvailable }))
vi.mock('../../../../src/lib/api', () => ({ updateMe }))

const { UsernameStep } = await import('../../../../src/features/onboarding/components/UsernameStep')

afterEach(() => {
  checkUsernameAvailable.mockReset()
  updateMe.mockReset()
})

// OnboardingShell renders its children twice — a mobile copy and a desktop
// copy, CSS-toggled per breakpoint (same pattern as Welcome.tsx) — so every
// query here picks [0].
describe('UsernameStep', () => {
  it('loads and shows available suggestions derived from name/email', async () => {
    checkUsernameAvailable.mockImplementation(async (username: string) => ({
      available: username === 'arjun.kumar' || username === 'arjunkumar'
    }))

    render(<UsernameStep initialDisplayName="Arjun Kumar" email="arjun.kumar@gmail.com" onDone={vi.fn()} />)

    await waitFor(() => expect(screen.getAllByText('arjun.kumar').length).toBeGreaterThan(0))
    expect(screen.getAllByText('arjunkumar').length).toBeGreaterThan(0)
    expect(screen.queryByText('arjun_kumar')).not.toBeInTheDocument() // was reported unavailable
  })

  it('clicking a suggestion fills the username field', async () => {
    checkUsernameAvailable.mockResolvedValue({ available: true })
    render(<UsernameStep initialDisplayName="Arjun Kumar" email="arjun.kumar@gmail.com" onDone={vi.fn()} />)

    await waitFor(() => expect(screen.getAllByText('arjun.kumar').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('arjun.kumar')[0])

    expect(screen.getAllByLabelText(/username/i)[0]).toHaveValue('arjun.kumar')
  })

  it('debounced-checks a manually typed username and enables Continue once available', async () => {
    checkUsernameAvailable.mockResolvedValue({ available: true })
    render(<UsernameStep initialDisplayName="Arjun Kumar" email="arjun.kumar@gmail.com" onDone={vi.fn()} />)

    fireEvent.change(screen.getAllByLabelText(/^username$/i)[0], { target: { value: 'custom_name' } })

    await waitFor(() => expect(screen.getAllByText('This username is available').length).toBeGreaterThan(0))
    expect(screen.getAllByRole('button', { name: /continue/i })[0]).not.toBeDisabled()
  })

  it('shows an error and keeps Continue disabled when the username is taken', async () => {
    checkUsernameAvailable.mockResolvedValue({ available: false })
    render(<UsernameStep initialDisplayName="Arjun Kumar" email="arjun.kumar@gmail.com" onDone={vi.fn()} />)

    fireEvent.change(screen.getAllByLabelText(/^username$/i)[0], { target: { value: 'taken_name' } })

    await waitFor(() => expect(screen.getAllByText('That username is taken').length).toBeGreaterThan(0))
    expect(screen.getAllByRole('button', { name: /continue/i })[0]).toBeDisabled()
  })

  it('submits displayName + username and calls onDone', async () => {
    checkUsernameAvailable.mockResolvedValue({ available: true })
    updateMe.mockResolvedValue({})
    const onDone = vi.fn()
    render(<UsernameStep initialDisplayName="Arjun Kumar" email="arjun.kumar@gmail.com" onDone={onDone} />)

    fireEvent.change(screen.getAllByLabelText(/^username$/i)[0], { target: { value: 'custom_name' } })
    await waitFor(() => expect(screen.getAllByRole('button', { name: /continue/i })[0]).not.toBeDisabled())

    fireEvent.click(screen.getAllByRole('button', { name: /continue/i })[0])

    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(updateMe).toHaveBeenCalledWith({ displayName: 'Arjun Kumar', username: 'custom_name' })
  })
})
