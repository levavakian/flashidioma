import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReviewSession from '../../../src/components/review/ReviewSession'
import { db } from '../../../src/db'
import * as reviewService from '../../../src/services/review'
import * as deckService from '../../../src/services/deck'
import * as autoAddService from '../../../src/services/conjugationAutoAdd'
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

function makeNewCard(frontText: string, sortOrder: number): Card {
  return makeCard({
    frontText,
    backText: `translation ${sortOrder}`,
    sortOrder,
    fsrs: {
      stability: 0,
      difficulty: 0,
      dueDate: new Date().toISOString(),
      lastReview: null,
      reviewCount: 0,
      lapses: 0,
      state: 'new',
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      learningSteps: 0,
    },
  })
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

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
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

  it('shows upcoming same-day cards in stats and queue', async () => {
    const dayStartHour = (new Date().getHours() + 2) % 24
    await db.decks.update(deck.id, { dayStartHour })
    deck = { ...deck, dayStartHour }

    // Card due now
    const dueCard = makeCard({ frontText: 'due now', backText: 'ahora' })
    // Card due soon, before the configured review-day boundary
    const upcomingCard = makeCard({
      frontText: 'upcoming',
      backText: 'próximo',
      fsrs: {
        stability: 5.0,
        difficulty: 5.0,
        dueDate: new Date(Date.now() + 60 * 1000).toISOString(),
        lastReview: new Date(Date.now() - 86400000).toISOString(),
        reviewCount: 1,
        lapses: 0,
        state: 'review',
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 1,
      },
    })
    await db.cards.bulkPut([dueCard, upcomingCard])

    render(<ReviewSession deck={deck} onComplete={vi.fn()} />)
    await waitFor(() => {
      // Total due should show 2 (1 due now + 1 upcoming)
      expect(screen.getByText(/2 due/)).toBeInTheDocument()
    })
  })

  it('upcoming cards are in the queue (no waiting screen)', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    const dayStartHour = (new Date().getHours() + 2) % 24
    await db.decks.update(deck.id, { dayStartHour })
    deck = { ...deck, dayStartHour }

    // Card due now
    const dueCard = makeCard({ frontText: 'review me', backText: 'revísame' })
    // Card due soon, before the configured review-day boundary
    const upcomingCard = makeCard({
      frontText: 'later card',
      backText: 'después',
      fsrs: {
        stability: 5.0,
        difficulty: 5.0,
        dueDate: new Date(Date.now() + 60 * 1000).toISOString(),
        lastReview: new Date(Date.now() - 86400000).toISOString(),
        reviewCount: 1,
        lapses: 0,
        state: 'review',
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 1,
      },
    })
    await db.cards.bulkPut([dueCard, upcomingCard])

    render(<ReviewSession deck={deck} onComplete={onComplete} />)
    await waitFor(() => {
      expect(screen.getByText('review me')).toBeInTheDocument()
    })

    // Grade the first card — upcoming card should appear next, no waiting
    await user.click(screen.getByText('Show Answer'))
    await user.click(screen.getByText('Easy'))

    await waitFor(() => {
      expect(screen.getByText('later card')).toBeInTheDocument()
    })
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('does not immediately requeue a card scheduled for a future learning interval', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()

    // Card in learning state — "Hard" will schedule within minutes (well within day boundary)
    const card = makeCard({
      frontText: 'hard requeue',
      backText: 'recola difícil',
      fsrs: {
        stability: 0.4,
        difficulty: 5.0,
        dueDate: new Date(Date.now() - 60000).toISOString(),
        lastReview: new Date(Date.now() - 60000).toISOString(),
        reviewCount: 2,
        lapses: 1,
        state: 'learning',
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 2,
      },
    })
    await db.cards.put(card)

    render(<ReviewSession deck={deck} onComplete={onComplete} />)
    await waitFor(() => {
      expect(screen.getByText('hard requeue')).toBeInTheDocument()
    })

    // Grade "Hard" — learning card is scheduled minutes in the future, so it should wait
    await user.click(screen.getByText('Show Answer'))
    await user.click(screen.getByText('Hard'))

    await waitFor(() => {
      expect(screen.getByText(/Next card due in/)).toBeInTheDocument()
    })
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.queryByText('hard requeue')).not.toBeInTheDocument()
  })

  it('cards graded "Again" wait until their learning interval is due', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()

    const card = makeCard({ frontText: 'tough word', backText: 'palabra difícil' })
    await db.cards.put(card)

    render(<ReviewSession deck={deck} onComplete={onComplete} />)
    await waitFor(() => {
      expect(screen.getByText('tough word')).toBeInTheDocument()
    })

    // Grade "Again" — card should not reappear until its FSRS interval is due
    await user.click(screen.getByText('Show Answer'))
    await user.click(screen.getByText('Again'))

    await waitFor(() => {
      expect(screen.getByText(/Next card due in/)).toBeInTheDocument()
    })
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.queryByText('tough word')).not.toBeInTheDocument()
  })

  it('grading all cards "Again" does not cycle them before their learning interval is due', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()

    const card1 = makeCard({ frontText: 'word one', backText: 'uno' })
    const card2 = makeCard({ frontText: 'word two', backText: 'dos' })
    await db.cards.bulkPut([card1, card2])

    render(<ReviewSession deck={deck} onComplete={onComplete} />)

    // Wait for first card
    await waitFor(() => {
      const has1 = screen.queryByText('word one')
      const has2 = screen.queryByText('word two')
      expect(has1 || has2).toBeTruthy()
    })

    // Grade first card "Again"
    await user.click(screen.getByText('Show Answer'))
    await user.click(screen.getByText('Again'))

    // Should show the second card, but not the first card again yet
    await waitFor(() => {
      expect(screen.getByText('Show Answer')).toBeInTheDocument()
    })

    // Grade second card "Again"
    await user.click(screen.getByText('Show Answer'))
    await user.click(screen.getByText('Again'))

    await waitFor(() => {
      expect(screen.getByText(/Next card due in/)).toBeInTheDocument()
    })
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.queryByText('word one')).not.toBeInTheDocument()
    expect(screen.queryByText('word two')).not.toBeInTheDocument()
  })

  it('waits when the only card is scheduled for a future learning interval', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()

    const card = makeCard({ frontText: 'graduate me', backText: 'gradúame' })
    await db.cards.put(card)

    render(<ReviewSession deck={deck} onComplete={onComplete} />)
    await waitFor(() => {
      expect(screen.getByText('graduate me')).toBeInTheDocument()
    })

    // Grade "Again" — card is due later, so the mounted session waits for it
    await user.click(screen.getByText('Show Answer'))
    await user.click(screen.getByText('Again'))

    await waitFor(() => {
      expect(screen.getByText(/Next card due in/)).toBeInTheDocument()
    })
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.queryByText('graduate me')).not.toBeInTheDocument()
  })

  it('automatically queues a reviewed card when its short learning interval becomes due', async () => {
    const onComplete = vi.fn()

    const card = makeCard({ frontText: 'return soon', backText: 'vuelve pronto' })
    await db.cards.put(card)

    render(<ReviewSession deck={deck} onComplete={onComplete} />)
    await waitFor(() => {
      expect(screen.getByText('return soon')).toBeInTheDocument()
    })

    const now = new Date('2026-05-15T12:00:00.000Z')
    const dueAt = new Date(now.getTime() + 5000)
    const reviewedCard: Card = {
      ...card,
      fsrs: {
        ...card.fsrs,
        dueDate: dueAt.toISOString(),
        lastReview: now.toISOString(),
        state: 'learning',
      },
    }
    await db.cards.put(reviewedCard)

    vi.useFakeTimers()
    vi.setSystemTime(now)
    const reviewCardSpy = vi.spyOn(reviewService, 'reviewCard').mockResolvedValue(reviewedCard)
    vi.spyOn(reviewService, 'getDueCards').mockImplementation(async (_deckId, queryNow = new Date()) => (
      queryNow.getTime() >= dueAt.getTime() ? [reviewedCard] : []
    ))
    vi.spyOn(deckService, 'getDeck').mockResolvedValue(deck)
    vi.spyOn(autoAddService, 'maybeAutoAddConjugationCard').mockResolvedValue({ added: false })

    await act(async () => {
      fireEvent.click(screen.getByText('Show Answer'))
    })
    await act(async () => {
      fireEvent.click(screen.getByText('Again'))
      for (let i = 0; i < 20; i += 1) {
        await vi.advanceTimersByTimeAsync(0)
        await Promise.resolve()
      }
    })
    expect(reviewCardSpy).toHaveBeenCalled()
    await vi.waitFor(() => {
      expect(screen.getByText(/Next card due in/)).toBeInTheDocument()
    }, { timeout: 1000 })
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.queryByText('return soon')).not.toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(dueAt.getTime() - Date.now() + 1)
    })

    expect(screen.getByText('return soon')).toBeInTheDocument()
  })

  it('does not introduce another new-card batch after the current session batch is reviewed', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    deck = {
      ...deck,
      newCardBatchSize: 2,
      newCardsPerDay: 6,
      newCardsIntroducedToday: 0,
      lastNewCardDate: null,
      autoAddConjugations: false,
      maxConjugationCardsPerDay: 5,
      conjugationCardsAddedToday: 0,
      lastConjugationCardDate: null,
      requestRetention: 0.9,
    }
    await db.decks.put(deck)

    const cards = Array.from({ length: 6 }, (_, index) => makeNewCard(`new word ${index}`, index))
    await db.cards.bulkPut(cards)

    render(<ReviewSession deck={deck} onComplete={onComplete} />)
    await waitFor(() => {
      expect(screen.getByText('new word 0')).toBeInTheDocument()
      expect(screen.getByText(/2 remaining/)).toBeInTheDocument()
    })

    await user.click(screen.getByText('Show Answer'))
    await user.click(screen.getByText('Easy'))
    await waitFor(() => {
      expect(screen.getByText('new word 1')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Show Answer'))
    await user.click(screen.getByText('Easy'))

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled()
    })
    expect(screen.queryByText('new word 2')).not.toBeInTheDocument()
  })

  it('does not immediately cycle new cards graded Good before their learning interval is due', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    deck = {
      ...deck,
      newCardBatchSize: 2,
      newCardsPerDay: 6,
      newCardsIntroducedToday: 0,
      lastNewCardDate: null,
      autoAddConjugations: false,
      maxConjugationCardsPerDay: 5,
      conjugationCardsAddedToday: 0,
      lastConjugationCardDate: null,
      requestRetention: 0.9,
    }
    await db.decks.put(deck)

    const cards = Array.from({ length: 6 }, (_, index) => makeNewCard(`good word ${index}`, index))
    await db.cards.bulkPut(cards)

    render(<ReviewSession deck={deck} onComplete={onComplete} />)
    await waitFor(() => {
      expect(screen.getByText('good word 0')).toBeInTheDocument()
      expect(screen.getByText(/2 remaining/)).toBeInTheDocument()
    })

    await user.click(screen.getByText('Show Answer'))
    await user.click(screen.getByText('Good'))
    await waitFor(() => {
      expect(screen.getByText('good word 1')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Show Answer'))
    await user.click(screen.getByText('Good'))

    await waitFor(() => {
      expect(screen.getByText(/Next card due in/)).toBeInTheDocument()
    })
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.queryByText('good word 0')).not.toBeInTheDocument()
    expect(screen.queryByText('good word 2')).not.toBeInTheDocument()
  })

  it('reloads the queue when the deck prop changes', async () => {
    const deckTwo: Deck = {
      ...deck,
      id: 'test-deck-2',
      name: 'Second Deck',
    }
    await db.decks.put(deckTwo)

    const firstDeckCard = makeCard({ frontText: 'deck one card', backText: 'uno' })
    const secondDeckCard: Card = {
      ...makeCard({ frontText: 'deck two card', backText: 'dos' }),
      id: crypto.randomUUID(),
      deckId: deckTwo.id,
    }
    await db.cards.bulkPut([firstDeckCard, secondDeckCard])

    const { rerender } = render(<ReviewSession deck={deck} onComplete={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('deck one card')).toBeInTheDocument()
    })

    rerender(<ReviewSession deck={deckTwo} onComplete={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('deck two card')).toBeInTheDocument()
    })
    expect(screen.queryByText('deck one card')).not.toBeInTheDocument()
  })
})
