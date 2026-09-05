import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const updateMe = vi.fn()
vi.mock('../../../../src/lib/api', () => ({ updateMe }))

const { GenresStep } = await import('../../../../src/features/onboarding/components/GenresStep')

afterEach(() => updateMe.mockReset())

describe('GenresStep', () => {
  it('saves selected genres and calls onDone with them', async () => {
    updateMe.mockResolvedValue({})
    const onDone = vi.fn()
    render(<GenresStep onDone={onDone} />)

    fireEvent.click(screen.getAllByText('Comedy')[0])
    fireEvent.click(screen.getAllByRole('button', { name: /continue/i })[0])

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(['Comedy']))
    expect(updateMe).toHaveBeenCalledWith({ favoriteGenres: ['Comedy'] })
  })

  it('skip calls onDone with an empty list and does not save', () => {
    const onDone = vi.fn()
    render(<GenresStep onDone={onDone} />)

    fireEvent.click(screen.getAllByRole('button', { name: /skip/i })[0])

    expect(onDone).toHaveBeenCalledWith([])
    expect(updateMe).not.toHaveBeenCalled()
  })
})
