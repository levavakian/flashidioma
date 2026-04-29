import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConjugationBrowserPage from '../../../src/components/conjugations/ConjugationBrowserPage'

vi.mock('../../../src/services/conjugationLookup', () => ({
  getAllVerbInfinitives: vi.fn(async () =>
    Array.from({ length: 51 }, (_, index) => `verb-${String(index + 1).padStart(2, '0')}`)
  ),
  lookupConjugationExact: vi.fn(),
}))

vi.mock('../../../src/services/importDeck', () => ({
  getPrebuiltDeckCards: vi.fn(async () => []),
}))

describe('ConjugationBrowserPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('wraps pagination at the first and last pages', async () => {
    const user = userEvent.setup()
    render(<ConjugationBrowserPage />)

    await waitFor(() => {
      expect(screen.getByText('verb-01')).toBeInTheDocument()
    })
    expect(screen.getByText('1 / 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Prev' }))

    expect(screen.getByText('verb-51')).toBeInTheDocument()
    expect(screen.getByText('2 / 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByText('verb-01')).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })
})
