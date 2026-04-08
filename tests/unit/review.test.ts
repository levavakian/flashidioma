import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../src/db'
import { createDeck } from '../../src/services/deck'
import { createCard } from '../../src/services/card'
import {
  reviewCard,
  getDueCards,
  getNewCards,
  getNewCardBatch,
  getDueCardsWithin24h,
  getNextDueWithin24h,
  getDayBoundary,
  getSchedulingPreview,
  getReviewQueueFullDay,
} from '../../src/services/review'
import type { Deck } from '../../src/types'

let deck: Deck

beforeEach(async () => {
  await db.decks.clear()
  await db.cards.clear()
  await db.reviewHistory.clear()

  deck = await createDeck('Test Deck')
})

describe('FSRS scheduling', () => {
  it('reviews a new card and updates its state', async () => {
    const card = await createCard({
      deckId: deck.id,
      frontText: 'hello',
      backText: 'hola',
      direction: 'source-to-target',
    })

    expect(card.fsrs.state).toBe('new')

    const reviewed = await reviewCard(card.id, 3) // Good
    expect(reviewed.fsrs.state).not.toBe('new')
    expect(reviewed.fsrs.reviewCount).toBeGreaterThanOrEqual(1)
    expect(reviewed.fsrs.lastReview).toBeTruthy()
  })

  it('creates a review history entry on review', async () => {
    const card = await createCard({
      deckId: deck.id,
      frontText: 'cat',
      backText: 'gato',
      direction: 'source-to-target',
    })

    await reviewCard(card.id, 3)
    const history = await db.reviewHistory.where('cardId').equals(card.id).toArray()
    expect(history).toHaveLength(1)
    expect(history[0].grade).toBe(3)
    expect(history[0].deckId).toBe(deck.id)
  })

  it('handles all four grade buttons', async () => {
    const grades = [1, 2, 3, 4] // Again, Hard, Good, Easy

    for (const grade of grades) {
      const card = await createCard({
        deckId: deck.id,
        frontText: `word${grade}`,
        backText: `palabra${grade}`,
        direction: 'source-to-target',
      })

      const reviewed = await reviewCard(card.id, grade)
      expect(reviewed.fsrs.state).not.toBe('new')
    }
  })

  it('Easy produces a longer interval than Again', async () => {
    const card1 = await createCard({
      deckId: deck.id,
      frontText: 'easy',
      backText: 'fácil',
      direction: 'source-to-target',
    })
    const card2 = await createCard({
      deckId: deck.id,
      frontText: 'hard',
      backText: 'difícil',
      direction: 'source-to-target',
    })

    const now = new Date()
    const easy = await reviewCard(card1.id, 4, now) // Easy
    const again = await reviewCard(card2.id, 1, now) // Again

    const easyDue = new Date(easy.fsrs.dueDate).getTime()
    const againDue = new Date(again.fsrs.dueDate).getTime()

    expect(easyDue).toBeGreaterThan(againDue)
  })

  it('throws for invalid grade', async () => {
    const card = await createCard({
      deckId: deck.id,
      frontText: 'test',
      backText: 'prueba',
      direction: 'source-to-target',
    })

    await expect(reviewCard(card.id, 0)).rejects.toThrow('Invalid grade')
    await expect(reviewCard(card.id, 5)).rejects.toThrow('Invalid grade')
  })
})

describe('Due cards', () => {
  it('does not include new cards in due list', async () => {
    await createCard({
      deckId: deck.id,
      frontText: 'new',
      backText: 'nuevo',
      direction: 'source-to-target',
    })

    const due = await getDueCards(deck.id)
    expect(due).toHaveLength(0)
  })

  it('includes reviewed cards whose due date has passed', async () => {
    const card = await createCard({
      deckId: deck.id,
      frontText: 'hello',
      backText: 'hola',
      direction: 'source-to-target',
    })

    // Review the card with "Again" so it becomes due soon
    await reviewCard(card.id, 1)

    // Check far in the future
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    const due = await getDueCards(deck.id, future)
    expect(due.length).toBeGreaterThanOrEqual(1)
  })
})

describe('New card batch introduction', () => {
  it('introduces cards in batch size', async () => {
    // Create 10 new cards
    for (let i = 0; i < 10; i++) {
      await createCard({
        deckId: deck.id,
        frontText: `word${i}`,
        backText: `palabra${i}`,
        direction: 'source-to-target',
      })
    }

    const batch = await getNewCardBatch(deck)
    expect(batch).toHaveLength(5) // Default batch size
  })

  it('returns same batch until all are reviewed', async () => {
    for (let i = 0; i < 10; i++) {
      await createCard({
        deckId: deck.id,
        frontText: `word${i}`,
        backText: `palabra${i}`,
        direction: 'source-to-target',
      })
    }

    const batch1 = await getNewCardBatch(deck)
    const batch1Ids = batch1.map((c) => c.id).sort()

    // Refetch deck to get updated currentBatchCardIds
    const updatedDeck = (await db.decks.get(deck.id))!
    const batch2 = await getNewCardBatch(updatedDeck)
    const batch2Ids = batch2.map((c) => c.id).sort()

    expect(batch1Ids).toEqual(batch2Ids)
  })

  it('introduces next batch after current batch is fully reviewed', async () => {
    for (let i = 0; i < 10; i++) {
      await createCard({
        deckId: deck.id,
        frontText: `word${i}`,
        backText: `palabra${i}`,
        direction: 'source-to-target',
      })
    }

    const batch1 = await getNewCardBatch(deck)
    const batch1Ids = batch1.map((c) => c.id)

    // Review all cards in batch 1
    for (const id of batch1Ids) {
      await reviewCard(id, 3)
    }

    // Now get next batch
    const updatedDeck = (await db.decks.get(deck.id))!
    const batch2 = await getNewCardBatch(updatedDeck)
    expect(batch2).toHaveLength(5)

    // Batch 2 should be different from batch 1
    const batch2Ids = batch2.map((c) => c.id)
    expect(batch2Ids).not.toEqual(batch1Ids)
  })

  it('returns empty when no new cards remain', async () => {
    await createCard({
      deckId: deck.id,
      frontText: 'only',
      backText: 'solo',
      direction: 'source-to-target',
    })

    const batch = await getNewCardBatch(deck)
    expect(batch).toHaveLength(1)

    // Review the card
    await reviewCard(batch[0].id, 3)

    const updatedDeck = (await db.decks.get(deck.id))!
    const nextBatch = await getNewCardBatch(updatedDeck)
    expect(nextBatch).toHaveLength(0)
  })

  it('lists new cards correctly', async () => {
    const card = await createCard({
      deckId: deck.id,
      frontText: 'new',
      backText: 'nuevo',
      direction: 'source-to-target',
    })

    const newCards = await getNewCards(deck.id)
    expect(newCards).toHaveLength(1)
    expect(newCards[0].id).toBe(card.id)

    // After review, card should not appear in new cards
    await reviewCard(card.id, 3)
    const afterReview = await getNewCards(deck.id)
    expect(afterReview).toHaveLength(0)
  })

  it('counts a manually added card only once against the daily new-card total', async () => {
    const card = await createCard({
      deckId: deck.id,
      frontText: 'manual',
      backText: 'manual',
      direction: 'source-to-target',
    })

    let storedDeck = (await db.decks.get(deck.id))!
    expect(storedDeck.newCardsIntroducedToday).toBe(0)

    await reviewCard(card.id, 3)

    storedDeck = (await db.decks.get(deck.id))!
    expect(storedDeck.newCardsIntroducedToday).toBe(1)
  })

  it('counts imported cards when they are first reviewed out of new state', async () => {
    const card = await createCard({
      deckId: deck.id,
      frontText: 'imported',
      backText: 'importado',
      direction: 'source-to-target',
      source: 'imported',
    })

    let storedDeck = (await db.decks.get(deck.id))!
    expect(storedDeck.newCardsIntroducedToday).toBe(0)

    await reviewCard(card.id, 3)

    storedDeck = (await db.decks.get(deck.id))!
    expect(storedDeck.newCardsIntroducedToday).toBe(1)
  })

  it('does not count auto-conjugation cards against the daily new-card total', async () => {
    const card = await createCard({
      deckId: deck.id,
      frontText: 'we eat',
      backText: 'comemos',
      direction: 'source-to-target',
      source: 'auto-conjugation',
    })

    let storedDeck = (await db.decks.get(deck.id))!
    expect(storedDeck.newCardsIntroducedToday).toBe(0)

    await reviewCard(card.id, 3)

    storedDeck = (await db.decks.get(deck.id))!
    expect(storedDeck.newCardsIntroducedToday).toBe(0)
  })

  it('still returns an unfinished new-card batch even when the daily counter is already full', async () => {
    deck = await createDeck('Manual Cards')
    deck = await db.decks.get(deck.id) as Deck
    await db.decks.update(deck.id, {
      newCardsPerDay: 2,
      newCardBatchSize: 2,
    })

    const first = await createCard({
      deckId: deck.id,
      frontText: 'first',
      backText: 'uno',
      direction: 'source-to-target',
    })
    const second = await createCard({
      deckId: deck.id,
      frontText: 'second',
      backText: 'dos',
      direction: 'source-to-target',
    })

    await db.decks.update(deck.id, {
      currentBatchCardIds: [first.id, second.id],
    })

    const storedDeck = (await db.decks.get(deck.id))!
    expect(storedDeck.newCardsIntroducedToday).toBe(0)

    const batch = await getNewCardBatch(storedDeck)
    expect(batch.map((card) => card.frontText).sort()).toEqual(['first', 'second'])
  })
})

describe('24h review window', () => {
  it('getDueCardsWithin24h returns cards due within 24 hours', async () => {
    const now = new Date('2025-06-01T12:00:00Z')

    const card = await createCard({
      deckId: deck.id,
      frontText: 'test',
      backText: 'prueba',
      direction: 'source-to-target',
    })

    // Review with "Again" to make it due soon (within minutes)
    await reviewCard(card.id, 1, now)

    // Should appear in 24h window
    const within24h = await getDueCardsWithin24h(deck.id, now)
    expect(within24h.length).toBeGreaterThanOrEqual(1)
  })

  it('getDueCardsWithin24h excludes new cards', async () => {
    await createCard({
      deckId: deck.id,
      frontText: 'newcard',
      backText: 'nuevocarta',
      direction: 'source-to-target',
    })

    const within24h = await getDueCardsWithin24h(deck.id)
    expect(within24h).toHaveLength(0)
  })

  it('getDueCardsWithin24h excludes cards due beyond 24h', async () => {
    const now = new Date('2025-06-01T12:00:00Z')

    const card = await createCard({
      deckId: deck.id,
      frontText: 'test',
      backText: 'prueba',
      direction: 'source-to-target',
    })

    // Review with "Easy" to push due date far into the future
    await reviewCard(card.id, 4, now)

    // Card should be due days from now, not within 24h
    const within24h = await getDueCardsWithin24h(deck.id, now)
    expect(within24h).toHaveLength(0)
  })

  it('getNextDueWithin24h returns earliest upcoming due date', async () => {
    const now = new Date('2025-06-01T12:00:00Z')

    const card = await createCard({
      deckId: deck.id,
      frontText: 'test',
      backText: 'prueba',
      direction: 'source-to-target',
    })

    // Review with "Again" — card will be due in a few minutes
    await reviewCard(card.id, 1, now)

    const nextDue = await getNextDueWithin24h(deck.id, now)
    expect(nextDue).not.toBeNull()
    expect(nextDue!.getTime()).toBeGreaterThan(now.getTime())
    expect(nextDue!.getTime()).toBeLessThanOrEqual(now.getTime() + 24 * 60 * 60 * 1000)
  })

  it('getNextDueWithin24h returns null when no cards within window', async () => {
    const now = new Date('2025-06-01T12:00:00Z')

    const card = await createCard({
      deckId: deck.id,
      frontText: 'test',
      backText: 'prueba',
      direction: 'source-to-target',
    })

    // Review with "Easy" — card due far in the future
    await reviewCard(card.id, 4, now)

    const nextDue = await getNextDueWithin24h(deck.id, now)
    expect(nextDue).toBeNull()
  })
})

describe('getSchedulingPreview vs reviewCard', () => {
  it('getSchedulingPreview matches reviewCard stored dueDate for each grade', async () => {
    const now = new Date('2026-04-08T14:00:00.000Z')
    const card = await createCard({
      deckId: deck.id,
      frontText: 'preview',
      backText: 'vista',
      direction: 'source-to-target',
    })
    for (const grade of [1, 2, 3, 4] as const) {
      const fresh = await db.cards.get(card.id)
      expect(fresh).toBeDefined()
      const preview = getSchedulingPreview(fresh!, now)[grade].getTime()
      const after = await reviewCard(card.id, grade, now)
      const stored = new Date(after.fsrs.dueDate).getTime()
      expect(stored).toBe(preview)
      // reset card to new for next iteration
      await db.cards.update(card.id, {
        fsrs: {
          stability: 0,
          difficulty: 0,
          dueDate: now.toISOString(),
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
  })

  it('mature card: preview Easy matches persisted Easy dueDate', async () => {
    const now = new Date('2026-04-08T14:00:00.000Z')
    const card = await createCard({
      deckId: deck.id,
      frontText: 'mature',
      backText: 'maduro',
      direction: 'source-to-target',
    })
    await reviewCard(card.id, 4, now)
    await reviewCard(card.id, 4, new Date(now.getTime() + 86400000))
    const mature = await db.cards.get(card.id)
    expect(mature).toBeDefined()
    const previewEasy = getSchedulingPreview(mature!, now, deck.requestRetention ?? 0.9)[4].getTime()
    const afterEasy = await reviewCard(card.id, 4, now, deck.requestRetention ?? 0.9)
    expect(new Date(afterEasy.fsrs.dueDate).getTime()).toBe(previewEasy)
  })

  it('getReviewQueueFullDay includes upcoming before day boundary (not 21d-out cards)', async () => {
    const now = new Date('2026-04-08T14:00:00.000Z')
    await db.decks.update(deck.id, { dayStartHour: 9 })
    const boundary = getDayBoundary(now, 9)
    const dueSoon = await createCard({
      deckId: deck.id,
      frontText: 'soon',
      backText: 'pronto',
      direction: 'source-to-target',
    })
    // Halfway between now and end-of-review-day — always upcoming for this deck.dayStartHour in any TZ
    const dueBetween = new Date(now.getTime() + (boundary.getTime() - now.getTime()) / 2)
    expect(dueBetween > now && dueBetween <= boundary).toBe(true)
    await db.cards.update(dueSoon.id, {
      fsrs: {
        stability: 5,
        difficulty: 5,
        dueDate: dueBetween.toISOString(),
        lastReview: new Date(now.getTime() - 86400000).toISOString(),
        reviewCount: 2,
        lapses: 0,
        state: 'review',
        elapsedDays: 1,
        scheduledDays: 1,
        reps: 2,
        learningSteps: 0,
      },
    })

    const { upcomingCards } = await getReviewQueueFullDay(deck, now)
    expect(upcomingCards.some(c => c.id === dueSoon.id)).toBe(true)

    const far = await createCard({
      deckId: deck.id,
      frontText: 'far',
      backText: 'lejos',
      direction: 'source-to-target',
    })
    await db.cards.update(far.id, {
      fsrs: {
        stability: 20,
        difficulty: 5,
        dueDate: new Date(now.getTime() + 21 * 86400000).toISOString(),
        lastReview: now.toISOString(),
        reviewCount: 5,
        lapses: 0,
        state: 'review',
        elapsedDays: 21,
        scheduledDays: 21,
        reps: 5,
        learningSteps: 0,
      },
    })
    const q2 = await getReviewQueueFullDay(deck, now)
    expect(q2.upcomingCards.some(c => c.id === far.id)).toBe(false)
  })
})

describe('getDayBoundary', () => {
  it('returns tomorrow at dayStartHour when now is past start hour', () => {
    const now = new Date('2025-06-01T10:00:00') // 10am
    const boundary = getDayBoundary(now, 9)
    expect(boundary.getHours()).toBe(9)
    expect(boundary.getMinutes()).toBe(0)
    expect(boundary.getDate()).toBe(2) // June 2 (tomorrow)
  })

  it('returns today at dayStartHour when now is before start hour', () => {
    const now = new Date('2025-06-01T07:00:00') // 7am
    const boundary = getDayBoundary(now, 9)
    expect(boundary.getHours()).toBe(9)
    expect(boundary.getMinutes()).toBe(0)
    expect(boundary.getDate()).toBe(1) // June 1 (today)
  })

  it('returns tomorrow when now is late at night', () => {
    const now = new Date('2025-06-01T23:00:00') // 11pm
    const boundary = getDayBoundary(now, 9)
    expect(boundary.getHours()).toBe(9)
    expect(boundary.getDate()).toBe(2) // June 2
  })

  it('returns tomorrow when now is exactly at start hour', () => {
    const now = new Date('2025-06-01T09:00:00') // exactly 9am
    const boundary = getDayBoundary(now, 9)
    expect(boundary.getDate()).toBe(2) // tomorrow
  })

  it('works with midnight (hour 0)', () => {
    const now = new Date('2025-06-01T23:30:00') // 11:30pm
    const boundary = getDayBoundary(now, 0)
    expect(boundary.getHours()).toBe(0)
    expect(boundary.getDate()).toBe(2) // June 2
  })

  it('defaults to hour 9', () => {
    const now = new Date('2025-06-01T10:00:00')
    const boundary = getDayBoundary(now)
    expect(boundary.getHours()).toBe(9)
    expect(boundary.getDate()).toBe(2)
  })
})
