import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ImportDecksPage from '../../../src/components/decks/ImportDecksPage'
import { db } from '../../../src/db'
import { createDeck } from '../../../src/services/deck'

beforeEach(async () => {
  await db.decks.clear()
  await db.cards.clear()
  await db.sideDeckCards.clear()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <ImportDecksPage />
    </MemoryRouter>
  )
}

describe('ImportDecksPage', () => {
  it('shows available pre-built decks', async () => {
    await createDeck('Test Deck')
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Spanish Frequency (Top Words)')).toBeInTheDocument()
    })

    // Should show card count
    expect(screen.getByText(/cards available/)).toBeInTheDocument()
  })

  it('imports cards into a user deck', async () => {
    const deck = await createDeck('My Spanish')
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Spanish Frequency (Top Words)')).toBeInTheDocument()
    })

    // Set a small limit to keep the test fast
    const limitInput = screen.getByDisplayValue('500')
    const user = userEvent.setup()
    await user.clear(limitInput)
    await user.type(limitInput, '5')

    // Click Import
    await user.click(screen.getByRole('button', { name: 'Import' }))

    // Wait for import to complete
    await waitFor(() => {
      expect(screen.getByText(/Imported 5 cards/)).toBeInTheDocument()
    })

    // Verify cards in DB
    const cards = await db.cards.where('deckId').equals(deck.id).toArray()
    expect(cards).toHaveLength(5)
  })

  it('importing twice does not create duplicates', async () => {
    const deck = await createDeck('My Spanish')
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Spanish Frequency (Top Words)')).toBeInTheDocument()
    })

    const user = userEvent.setup()
    const limitInput = screen.getByDisplayValue('500')
    await user.clear(limitInput)
    await user.type(limitInput, '3')

    // First import
    await user.click(screen.getByRole('button', { name: 'Import' }))
    await waitFor(() => {
      expect(screen.getByText(/Imported 3 cards/)).toBeInTheDocument()
    })

    // Second import
    await user.click(screen.getByRole('button', { name: 'Import' }))
    await waitFor(() => {
      expect(screen.getByText(/skipped 3 duplicates/)).toBeInTheDocument()
    })

    // Should still only have 3 cards
    const cards = await db.cards.where('deckId').equals(deck.id).toArray()
    expect(cards).toHaveLength(3)
  })
})
