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

describe('UsernameStep', () => {
  it('loads and shows available suggestions derived from name/email', async () => {
    checkUsernameAvailable.mockImplementation(async (username: string) => ({
      available: username === 'arjun.kumar' || username === 'arjunkumar'
    }))

    render(<UsernameStep initialDisplayName="Arjun Kumar" email="arjun.kumar@gmail.com" onDone={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('arjun.kumar')).toBeInTheDocument())
    expect(screen.getByText('arjunkumar')).toBeInTheDocument()
    expect(screen.queryByText('arjun_kumar')).not.toBeInTheDocument() // was reported unavailable
  })

  it('clicking a suggestion fills the username field', async () => {
    checkUsernameAvailable.mockResolvedValue({ available: true })
    render(<UsernameStep initialDisplayName="Arjun Kumar" email="arjun.kumar@gmail.com" onDone={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('arjun.kumar')).toBeInTheDocument())
    fireEvent.click(screen.getByText('arjun.kumar'))

    expect(screen.getByLabelText(/username/i)).toHaveValue('arjun.kumar')
  })

  it('debounced-checks a manually typed username and enables Continue once available', async () => {
    checkUsernameAvailable.mockResolvedValue({ available: true })
    render(<UsernameStep initialDisplayName="Arjun Kumar" email="arjun.kumar@gmail.com" onDone={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/^username$/i), { target: { value: 'custom_name' } })

    await waitFor(() => expect(screen.getByText('This username is available')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })

  it('shows an error and keeps Continue disabled when the username is taken', async () => {
    checkUsernameAvailable.mockResolvedValue({ available: false })
    render(<UsernameStep initialDisplayName="Arjun Kumar" email="arjun.kumar@gmail.com" onDone={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/^username$/i), { target: { value: 'taken_name' } })

    await waitFor(() => expect(screen.getByText('That username is taken')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  it('submits displayName + username and calls onDone', async () => {
    checkUsernameAvailable.mockResolvedValue({ available: true })
    updateMe.mockResolvedValue({})
    const onDone = vi.fn()
    render(<UsernameStep initialDisplayName="Arjun Kumar" email="arjun.kumar@gmail.com" onDone={onDone} />)

    fireEvent.change(screen.getByLabelText(/^username$/i), { target: { value: 'custom_name' } })
    await waitFor(() => expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled())

    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(updateMe).toHaveBeenCalledWith({ displayName: 'Arjun Kumar', username: 'custom_name' })
  })
})
