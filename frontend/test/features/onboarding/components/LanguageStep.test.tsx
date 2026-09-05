import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const updateMe = vi.fn()
vi.mock('../../../../src/lib/api', () => ({ updateMe }))

const { LanguageStep } = await import('../../../../src/features/onboarding/components/LanguageStep')

afterEach(() => updateMe.mockReset())

describe('LanguageStep', () => {
  it('saves selected language codes (not display labels) and calls onDone with them', async () => {
    updateMe.mockResolvedValue({})
    const onDone = vi.fn()
    render(<LanguageStep onDone={onDone} />)

    fireEvent.click(screen.getAllByText('Korean')[0])
    fireEvent.click(screen.getAllByRole('button', { name: /continue/i })[0])

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(['ko']))
    expect(updateMe).toHaveBeenCalledWith({ preferredLanguages: ['ko'] })
  })

  it('skip calls onDone with an empty list and does not save', () => {
    const onDone = vi.fn()
    render(<LanguageStep onDone={onDone} />)

    fireEvent.click(screen.getAllByRole('button', { name: /skip/i })[0])

    expect(onDone).toHaveBeenCalledWith([])
    expect(updateMe).not.toHaveBeenCalled()
  })
})
