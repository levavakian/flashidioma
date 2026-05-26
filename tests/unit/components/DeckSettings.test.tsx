import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DeckSettings from '../../../src/components/decks/DeckSettings'
import { db } from '../../../src/db'
import { createDeck, getDeck } from '../../../src/services/deck'
import { createCard } from '../../../src/services/card'
import { getDayBoundary } from '../../../src/services/review'
import type { Card, Deck, FSRSState } from '../../../src/types'

beforeEach(async () => {
  await db.decks.clear()
  await db.cards.clear()
})

async function cardWithState(deckId: string, fsrs: Partial<FSRSState>): Promise<Card> {
  const card = await createCard({
    deckId,
    frontText: crypto.randomUUID(),
    backText: crypto.randomUUID(),
    direction: 'source-to-target',
  })
  const updatedCard = {
    ...card,
    fsrs: {
      ...card.fsrs,
      ...fsrs,
    },
  }
  await db.cards.put(updatedCard)
  return updatedCard
}

describe('DeckSettings', () => {
  it('repairs a legacy deck and reports changed fields', async () => {
    const user = userEvent.setup()
    const legacyDeck = {
      id: 'legacy-settings',
      name: 'Legacy Settings',
      targetLanguage: 'spanish',
      createdAt: new Date().toISOString(),
      constructChecklist: undefined,
    } as unknown as Deck
    await db.decks.put(legacyDeck)

    render(<DeckSettings deck={legacyDeck} cards={[]} onUpdate={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Update Deck Schema' }))

    await waitFor(() => {
      expect(screen.getByText(/Updated deck schema:/)).toBeInTheDocument()
    })
    expect(await getDeck(legacyDeck.id)).toMatchObject({
      newCardsPerDay: 20,
      currentBatchCardIds: [],
      dayStartHour: 9,
    })
  })

  it('reports when the deck schema is already up to date', async () => {
    const user = userEvent.setup()
    const deck = await createDeck('Current Settings')

    render(<DeckSettings deck={deck} cards={[]} onUpdate={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Update Deck Schema' }))

    await waitFor(() => {
      expect(screen.getByText('Deck schema is already up to date.')).toBeInTheDocument()
    })
  })

  it('shows compact stats derived from the deck cards', async () => {
    const deck = await createDeck('Stats Deck')
    const now = new Date()
    const afterReviewDay = new Date(getDayBoundary(now, deck.dayStartHour).getTime() + 60 * 60 * 1000)
    const cards = [
      await cardWithState(deck.id, { state: 'new', dueDate: now.toISOString() }),
      await cardWithState(deck.id, { state: 'learning', dueDate: now.toISOString() }),
      await cardWithState(deck.id, { state: 'relearning', dueDate: now.toISOString() }),
      await cardWithState(deck.id, { state: 'review', dueDate: now.toISOString() }),
      await cardWithState(deck.id, { state: 'review', dueDate: afterReviewDay.toISOString() }),
    ]

    render(<DeckSettings deck={deck} cards={cards} onUpdate={() => {}} />)

    expect(screen.getByLabelText('Total cards: 5')).toBeInTheDocument()
    expect(screen.getByLabelText('New: 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Learning: 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Review: 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Due today: 3')).toBeInTheDocument()
  })
})
