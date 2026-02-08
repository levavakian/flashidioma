import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReviewSession from '../../../src/components/review/ReviewSession'
import { db } from '../../../src/db'
import type { Deck, Card } from '../../../src/types'

let deck: Deck

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: crypto.randomUUID(),
    deckId: deck.id,
    frontText: 'hello',
    backText: 'hola',
    direction: 'source-to-target',
    tags: [],
    notes: '',
    fsrs: {
      stability: 5.0,
      difficulty: 5.0,
      dueDate: new Date(Date.now() - 86400000).toISOString(), // yesterday
      lastReview: new Date(Date.now() - 86400000 * 2).toISOString(),
      reviewCount: 1,
      lapses: 0,
      state: 'review',
      elapsedDays: 1,
      scheduledDays: 1,
      reps: 1,
    },
    createdAt: new Date().toISOString(),
    source: 'manual',
    ...overrides,
  }
}

beforeEach(async () => {
  await db.decks.clear()
  await db.cards.clear()
  await db.reviewHistory.clear()

  deck = {
    id: 'test-deck',
    name: 'Test',
    targetLanguage: 'spanish',
    createdAt: new Date().toISOString(),
    constructChecklist: { present: true },
    newCardBatchSize: 5,
    currentBatchCardIds: [],
  }
  await db.decks.put(deck)
})

describe('ReviewSession', () => {
  it('shows empty state when no cards to review', async () => {
    render(<ReviewSession deck={deck} onComplete={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('No cards to review right now.')).toBeInTheDocument()
    })
  })

  it('shows card front initially', async () => {
    const card = makeCard({ frontText: 'water', backText: 'agua' })
    await db.cards.put(card)

    render(<ReviewSession deck={deck} onComplete={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('water')).toBeInTheDocument()
    })
    expect(screen.queryByText('agua')).not.toBeInTheDocument()
  })

  it('reveals back after clicking Show Answer', async () => {
    const user = userEvent.setup()
    const card = makeCard({ frontText: 'fire', backText: 'fuego' })
    await db.cards.put(card)

    render(<ReviewSession deck={deck} onComplete={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('fire')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Show Answer'))
    expect(screen.getByText('fuego')).toBeInTheDocument()
    expect(screen.getByText('Again')).toBeInTheDocument()
    expect(screen.getByText('Hard')).toBeInTheDocument()
    expect(screen.getByText('Good')).toBeInTheDocument()
    expect(screen.getByText('Easy')).toBeInTheDocument()
  })

  it('advances to next card after grading', async () => {
    const user = userEvent.setup()
    const card1 = makeCard({ frontText: 'sun', backText: 'sol' })
    const card2 = makeCard({ frontText: 'moon', backText: 'luna' })
    await db.cards.bulkPut([card1, card2])

    render(<ReviewSession deck={deck} onComplete={vi.fn()} />)

    // Wait for either card to appear (order is not guaranteed)
    let firstCard: string
    let secondCard: string
    await waitFor(() => {
      const hasSun = screen.queryByText('sun')
      const hasMoon = screen.queryByText('moon')
      expect(hasSun || hasMoon).toBeTruthy()
      firstCard = hasSun ? 'sun' : 'moon'
      secondCard = hasSun ? 'moon' : 'sun'
    })

    await user.click(screen.getByText('Show Answer'))
    await user.click(screen.getByText('Good'))

    await waitFor(() => {
      expect(screen.getByText(secondCard!)).toBeInTheDocument()
      expect(screen.queryByText(firstCard!)).not.toBeInTheDocument()
    })
  })

  it('calls onComplete when queue is exhausted', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    const card = makeCard({ frontText: 'only', backText: 'solo' })
    await db.cards.put(card)

    render(<ReviewSession deck={deck} onComplete={onComplete} />)
    await waitFor(() => {
      expect(screen.getByText('only')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Show Answer'))
    await user.click(screen.getByText('Good'))

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled()
    })
  })
})
