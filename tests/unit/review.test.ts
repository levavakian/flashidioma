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
  getNextDueInReviewDay,
  getDayBoundary,
  getReviewDayKey,
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

  it('includes auto-conjugation cards that start as learning immediately', async () => {
    const card = await createCard({
      deckId: deck.id,
      frontText: 'we eat [to eat (nosotros present)]',
      backText: 'comemos',
      direction: 'source-to-target',
      source: 'auto-conjugation',
      startAsLearning: true,
    })

    expect(card.fsrs.state).toBe('learning')
    const due = await getDueCards(deck.id, new Date())
    expect(due.map((dueCard) => dueCard.id)).toContain(card.id)
  })
})

describe('New card daily-set introduction', () => {
  it('introduces the full daily new-card allowance at once', async () => {
    for (let i = 0; i < 25; i++) {
      await createCard({
        deckId: deck.id,
        frontText: `word${i}`,
        backText: `palabra${i}`,
        direction: 'source-to-target',
      })
    }

    const dailySet = await getNewCardBatch(deck)
    expect(dailySet).toHaveLength(20) // Default daily allowance
  })

  it('returns same daily set until all are reviewed', async () => {
    for (let i = 0; i < 10; i++) {
      await createCard({
        deckId: deck.id,
        frontText: `word${i}`,
        backText: `palabra${i}`,
        direction: 'source-to-target',
      })
    }

    const dailySet1 = await getNewCardBatch(deck)
    const dailySet1Ids = dailySet1.map((c) => c.id).sort()

    // Refetch deck to get updated currentBatchCardIds
    const updatedDeck = (await db.decks.get(deck.id))!
    const dailySet2 = await getNewCardBatch(updatedDeck)
    const dailySet2Ids = dailySet2.map((c) => c.id).sort()

    expect(dailySet1Ids).toEqual(dailySet2Ids)
  })

  it('tops up a legacy partial active set to the full daily allowance', async () => {
    await db.decks.update(deck.id, { newCardsPerDay: 4 })
    deck = (await db.decks.get(deck.id))!

    const cards = []
    for (let i = 0; i < 6; i++) {
      cards.push(await createCard({
        deckId: deck.id,
        frontText: `legacy ${i}`,
        backText: `legado ${i}`,
        direction: 'source-to-target',
        sortOrder: i,
      }))
    }
    await db.decks.update(deck.id, { currentBatchCardIds: cards.slice(0, 2).map((card) => card.id) })

    const dailySet = await getNewCardBatch(deck)

    expect(dailySet.map((card) => card.frontText)).toEqual(['legacy 0', 'legacy 1', 'legacy 2', 'legacy 3'])
    expect((await db.decks.get(deck.id))!.currentBatchCardIds).toHaveLength(4)
  })

  it('does not introduce another daily set after the daily allowance is fully reviewed', async () => {
    await db.decks.update(deck.id, { newCardsPerDay: 5 })
    deck = (await db.decks.get(deck.id))!

    for (let i = 0; i < 10; i++) {
      await createCard({
        deckId: deck.id,
        frontText: `word${i}`,
        backText: `palabra${i}`,
        direction: 'source-to-target',
      })
    }

    const dailySet1 = await getNewCardBatch(deck)
    const dailySet1Ids = dailySet1.map((c) => c.id)

    // Review all cards in today's set.
    for (const id of dailySet1Ids) {
      await reviewCard(id, 3)
    }

    // Today's daily allowance is exhausted, so remaining new cards wait.
    const updatedDeck = (await db.decks.get(deck.id))!
    const dailySet2 = await getNewCardBatch(updatedDeck)
    expect(dailySet2).toHaveLength(0)
  })

  it('returns empty when no new cards remain', async () => {
    await createCard({
      deckId: deck.id,
      frontText: 'only',
      backText: 'solo',
      direction: 'source-to-target',
    })

    const dailySet = await getNewCardBatch(deck)
    expect(dailySet).toHaveLength(1)

    // Review the card
    await reviewCard(dailySet[0].id, 3)

    const updatedDeck = (await db.decks.get(deck.id))!
    const nextSet = await getNewCardBatch(updatedDeck)
    expect(nextSet).toHaveLength(0)
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

  it('counts manually added cards when they are introduced into the review queue', async () => {
    await createCard({
      deckId: deck.id,
      frontText: 'manual',
      backText: 'manual',
      direction: 'source-to-target',
    })

    let storedDeck = (await db.decks.get(deck.id))!
    expect(storedDeck.newCardsIntroducedToday).toBe(0)

    const dailySet = await getNewCardBatch(deck)
    expect(dailySet).toHaveLength(1)

    storedDeck = (await db.decks.get(deck.id))!
    expect(storedDeck.newCardsIntroducedToday).toBe(1)

    await reviewCard(dailySet[0].id, 3)
    storedDeck = (await db.decks.get(deck.id))!
    expect(storedDeck.newCardsIntroducedToday).toBe(1)
  })

  it('counts imported cards when they are introduced into the review queue', async () => {
    await createCard({
      deckId: deck.id,
      frontText: 'imported',
      backText: 'importado',
      direction: 'source-to-target',
      source: 'imported',
    })

    let storedDeck = (await db.decks.get(deck.id))!
    expect(storedDeck.newCardsIntroducedToday).toBe(0)

    await getNewCardBatch(deck)

    storedDeck = (await db.decks.get(deck.id))!
    expect(storedDeck.newCardsIntroducedToday).toBe(1)
  })

  it('does not count auto-conjugation cards against the daily new-card total', async () => {
    await createCard({
      deckId: deck.id,
      frontText: 'we eat',
      backText: 'comemos',
      direction: 'source-to-target',
      source: 'auto-conjugation',
    })

    let storedDeck = (await db.decks.get(deck.id))!
    expect(storedDeck.newCardsIntroducedToday).toBe(0)

    const dailySet = await getNewCardBatch(deck)
    expect(dailySet).toHaveLength(1)

    storedDeck = (await db.decks.get(deck.id))!
    expect(storedDeck.newCardsIntroducedToday).toBe(0)
  })

  it('starts auto-conjugation cards as new by default', async () => {
    const card = await createCard({
      deckId: deck.id,
      frontText: 'you speak [to speak (tú present)]',
      backText: 'hablas',
      direction: 'source-to-target',
      source: 'auto-conjugation',
    })

    expect(card.fsrs.state).toBe('new')
    expect(await getDueCards(deck.id, new Date())).toHaveLength(0)
  })

  it('still returns an unfinished daily new-card set even when the daily counter is already full', async () => {
    deck = await createDeck('Manual Cards')
    deck = await db.decks.get(deck.id) as Deck
    const today = getReviewDayKey()
    await db.decks.update(deck.id, {
      newCardsPerDay: 2,
      newCardBatchSize: 2,
      // Set the counter to the daily limit to simulate a full day
      newCardsIntroducedToday: 2,
      lastNewCardDate: today,
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
    expect(storedDeck.newCardsIntroducedToday).toBe(2)

    // Even though the daily limit is reached, the current in-progress set must still be returned.
    const dailySet = await getNewCardBatch(storedDeck)
    expect(dailySet.map((card) => card.frontText).sort()).toEqual(['first', 'second'])
  })

  it('respects the daily new-card limit even when called with a stale deck object', async () => {
    // Regression test: getNewCardBatch must always read fresh counters from the DB,
    // not rely on the (potentially stale) deck object passed in.
    deck = await createDeck('Stale Deck Test')
    const today = getReviewDayKey()
    await db.decks.update(deck.id, {
      newCardsPerDay: 3,
      newCardBatchSize: 3,
    })

    // Capture the stale deck object (newCardsIntroducedToday = 0)
    const staleDeck = (await db.decks.get(deck.id))!
    expect(staleDeck.newCardsIntroducedToday).toBe(0)

    // Create 6 new cards
    for (let i = 0; i < 6; i++) {
      await createCard({
        deckId: deck.id,
        frontText: `word${i}`,
        backText: `palabra${i}`,
        direction: 'source-to-target',
      })
    }

    // Simulate that 3 cards have already been introduced today (written to DB but not in staleDeck)
    await db.decks.update(deck.id, {
      newCardsIntroducedToday: 3,
      lastNewCardDate: today,
    })

    // When called with the stale deck, getNewCardBatch must read the DB and return 0 new cards
    const dailySet = await getNewCardBatch(staleDeck)
    expect(dailySet).toHaveLength(0)
  })

  it('resets the daily new-card limit at the deck review-day boundary', async () => {
    await db.decks.update(deck.id, {
      dayStartHour: 9,
      newCardsPerDay: 1,
      newCardBatchSize: 1,
      newCardsIntroducedToday: 1,
      lastNewCardDate: '2025-06-01',
    })
    deck = (await db.decks.get(deck.id))!

    for (let i = 0; i < 2; i++) {
      const card = await createCard({
        deckId: deck.id,
        frontText: `boundary ${i}`,
        backText: `límite ${i}`,
        direction: 'source-to-target',
        sortOrder: i,
      })
      await db.cards.update(card.id, {
        fsrs: {
          ...card.fsrs,
          dueDate: new Date('2025-06-02T09:00:00').toISOString(),
        },
      })
    }

    const beforeBoundary = await getNewCardBatch(deck, new Date('2025-06-02T08:00:00'))
    expect(beforeBoundary).toHaveLength(0)

    const afterBoundary = await getNewCardBatch(deck, new Date('2025-06-02T09:01:00'))
    expect(afterBoundary.map((card) => card.frontText)).toEqual(['boundary 0'])
    expect((await db.decks.get(deck.id))!.lastNewCardDate).toBe('2025-06-02')
  })

  it('records new-card introductions against the deck review day instead of UTC calendar day', async () => {
    await db.decks.update(deck.id, { dayStartHour: 9 })
    deck = (await db.decks.get(deck.id))!

    const card = await createCard({
      deckId: deck.id,
      frontText: 'early review',
      backText: 'repaso temprano',
      direction: 'source-to-target',
    })
    await db.cards.update(card.id, {
      fsrs: {
        ...card.fsrs,
        dueDate: new Date('2025-06-02T08:00:00').toISOString(),
      },
    })

    await getNewCardBatch(deck, new Date('2025-06-02T08:00:00'))

    const storedDeck = (await db.decks.get(deck.id))!
    expect(storedDeck.newCardsIntroducedToday).toBe(1)
    expect(storedDeck.lastNewCardDate).toBe('2025-06-01')
  })

  it('does not introduce endless new daily sets after the first set is reviewed', async () => {
    await db.decks.update(deck.id, { newCardsPerDay: 3 })
    deck = (await db.decks.get(deck.id))!

    for (let i = 0; i < 9; i++) {
      await createCard({
        deckId: deck.id,
        frontText: `limited ${i}`,
        backText: `limitado ${i}`,
        direction: 'source-to-target',
        sortOrder: i,
      })
    }

    const dailySet = await getNewCardBatch(deck)
    expect(dailySet.map((card) => card.frontText)).toEqual(['limited 0', 'limited 1', 'limited 2'])
    expect((await db.decks.get(deck.id))!.newCardsIntroducedToday).toBe(3)

    for (const card of dailySet) {
      await reviewCard(card.id, 4)
    }

    const nextSet = await getNewCardBatch((await db.decks.get(deck.id))!)
    expect(nextSet).toHaveLength(0)
    expect((await getNewCards(deck.id)).map((card) => card.frontText).sort()).toEqual([
      'limited 3',
      'limited 4',
      'limited 5',
      'limited 6',
      'limited 7',
      'limited 8',
    ])
  })

  it('clears a completed active daily set even when the daily limit blocks the next set', async () => {
    await db.decks.update(deck.id, {
      newCardsPerDay: 1,
      newCardBatchSize: 1,
    })
    deck = (await db.decks.get(deck.id))!

    const first = await createCard({
      deckId: deck.id,
      frontText: 'first set',
      backText: 'primero',
      direction: 'source-to-target',
      sortOrder: 0,
    })
    await createCard({
      deckId: deck.id,
      frontText: 'blocked next',
      backText: 'bloqueado',
      direction: 'source-to-target',
      sortOrder: 1,
    })
    await db.cards.update(first.id, {
      fsrs: {
        ...first.fsrs,
        dueDate: new Date('2025-06-01T10:00:00').toISOString(),
      },
    })

    const dailySet = await getNewCardBatch(deck, new Date('2025-06-01T10:00:00'))
    expect(dailySet.map((card) => card.id)).toEqual([first.id])

    await reviewCard(first.id, 3, new Date('2025-06-01T10:05:00'))
    const cappedDeck = (await db.decks.get(deck.id))!
    expect(cappedDeck.currentBatchCardIds).toEqual([first.id])

    const nextSet = await getNewCardBatch(cappedDeck, new Date('2025-06-01T10:06:00'))
    expect(nextSet).toHaveLength(0)
    expect((await db.decks.get(deck.id))!.currentBatchCardIds).toHaveLength(0)
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

  it('getNextDueInReviewDay returns the earliest card inside the deck review-day block', async () => {
    const now = new Date('2025-06-01T10:00:00')
    await db.decks.update(deck.id, { dayStartHour: 9 })
    deck = (await db.decks.get(deck.id))!

    const laterInBlock = await createCard({
      deckId: deck.id,
      frontText: 'later in block',
      backText: 'más tarde',
      direction: 'source-to-target',
    })
    await db.cards.update(laterInBlock.id, {
      fsrs: {
        ...laterInBlock.fsrs,
        state: 'learning',
        dueDate: new Date('2025-06-02T08:30:00').toISOString(),
        lastReview: now.toISOString(),
        reps: 1,
        reviewCount: 1,
      },
    })

    const earlierInBlock = await createCard({
      deckId: deck.id,
      frontText: 'earlier in block',
      backText: 'antes',
      direction: 'source-to-target',
    })
    await db.cards.update(earlierInBlock.id, {
      fsrs: {
        ...earlierInBlock.fsrs,
        state: 'learning',
        dueDate: new Date('2025-06-01T12:00:00').toISOString(),
        lastReview: now.toISOString(),
        reps: 1,
        reviewCount: 1,
      },
    })

    const nextDue = await getNextDueInReviewDay(deck, now)

    expect(nextDue?.toISOString()).toBe(new Date('2025-06-01T12:00:00').toISOString())
  })

  it('getNextDueInReviewDay excludes cards outside the deck review-day block even if within 24 hours', async () => {
    const now = new Date('2025-06-01T08:00:00')
    await db.decks.update(deck.id, { dayStartHour: 9 })
    deck = (await db.decks.get(deck.id))!

    const outsideBlock = await createCard({
      deckId: deck.id,
      frontText: 'outside block',
      backText: 'fuera',
      direction: 'source-to-target',
    })
    await db.cards.update(outsideBlock.id, {
      fsrs: {
        ...outsideBlock.fsrs,
        state: 'learning',
        dueDate: new Date('2025-06-01T10:00:00').toISOString(),
        lastReview: now.toISOString(),
        reps: 1,
        reviewCount: 1,
      },
    })

    const nextDue = await getNextDueInReviewDay(deck, now)

    expect(nextDue).toBeNull()
  })

  it('getReviewQueueFullDay can skip future upcoming cards and new-card sets', async () => {
    const now = new Date('2025-06-01T12:00:00')
    await db.decks.update(deck.id, {
      dayStartHour: 14,
      newCardBatchSize: 1,
      newCardsPerDay: 1,
    })
    deck = (await db.decks.get(deck.id))!

    const dueCard = await createCard({
      deckId: deck.id,
      frontText: 'due now',
      backText: 'ahora',
      direction: 'source-to-target',
    })
    await db.cards.update(dueCard.id, {
      fsrs: {
        ...dueCard.fsrs,
        state: 'review',
        dueDate: new Date('2025-06-01T11:00:00').toISOString(),
        lastReview: new Date('2025-05-31T12:00:00').toISOString(),
        reps: 1,
        reviewCount: 1,
      },
    })

    const upcomingCard = await createCard({
      deckId: deck.id,
      frontText: 'upcoming',
      backText: 'próximo',
      direction: 'source-to-target',
    })
    await db.cards.update(upcomingCard.id, {
      fsrs: {
        ...upcomingCard.fsrs,
        state: 'learning',
        dueDate: new Date('2025-06-01T13:00:00').toISOString(),
        lastReview: new Date('2025-06-01T12:00:00').toISOString(),
        reps: 1,
        reviewCount: 1,
      },
    })

    await createCard({
      deckId: deck.id,
      frontText: 'new card',
      backText: 'nueva',
      direction: 'source-to-target',
    })

    const queue = await getReviewQueueFullDay(deck, now, {
      includeNewCards: false,
      includeUpcomingCards: false,
    })

    expect(queue.dueCards.map((card) => card.frontText)).toEqual(['due now'])
    expect(queue.upcomingCards).toHaveLength(0)
    expect(queue.newCards).toHaveLength(0)
    expect((await db.decks.get(deck.id))!.currentBatchCardIds).toHaveLength(0)
  })

  it('getReviewQueueFullDay includes future learning cards inside the review-day boundary', async () => {
    const now = new Date('2025-06-01T12:00:00')
    await db.decks.update(deck.id, { dayStartHour: 14 })
    deck = (await db.decks.get(deck.id))!

    const learningCard = await createCard({
      deckId: deck.id,
      frontText: 'future learning',
      backText: 'aprendizaje futuro',
      direction: 'source-to-target',
    })
    await db.cards.update(learningCard.id, {
      fsrs: {
        ...learningCard.fsrs,
        state: 'learning',
        dueDate: new Date('2025-06-01T13:00:00').toISOString(),
        lastReview: now.toISOString(),
        reps: 1,
        reviewCount: 1,
      },
    })

    const queue = await getReviewQueueFullDay(deck, now, { includeNewCards: false })

    expect(queue.dueCards).toHaveLength(0)
    expect(queue.upcomingCards.map((card) => card.frontText)).toEqual(['future learning'])
  })

  it('getReviewQueueFullDay can preview new cards without introducing a daily set', async () => {
    await db.decks.update(deck.id, {
      newCardBatchSize: 2,
      newCardsPerDay: 2,
    })
    deck = (await db.decks.get(deck.id))!

    for (let i = 0; i < 4; i++) {
      await createCard({
        deckId: deck.id,
        frontText: `preview ${i}`,
        backText: `vista ${i}`,
        direction: 'source-to-target',
        sortOrder: i,
      })
    }

    const queue = await getReviewQueueFullDay(deck, new Date(), { introduceNewCards: false })

    expect(queue.newCards.map((card) => card.frontText)).toEqual(['preview 0', 'preview 1'])
    expect((await db.decks.get(deck.id))!.currentBatchCardIds).toHaveLength(0)
  })

  it('passive full-day queue refresh does not replace the active daily new-card set', async () => {
    await db.decks.update(deck.id, {
      newCardBatchSize: 2,
      newCardsPerDay: 4,
    })
    deck = (await db.decks.get(deck.id))!

    for (let i = 0; i < 4; i++) {
      await createCard({
        deckId: deck.id,
        frontText: `session ${i}`,
        backText: `sesión ${i}`,
        direction: 'source-to-target',
        sortOrder: i,
      })
    }

    const activeQueue = await getReviewQueueFullDay(deck)
    const activeBatchIds = activeQueue.newCards.map((card) => card.id)
    expect(activeQueue.newCards.map((card) => card.frontText)).toEqual(['session 0', 'session 1', 'session 2', 'session 3'])
    expect((await db.decks.get(deck.id))!.currentBatchCardIds).toEqual(activeBatchIds)

    for (const cardId of activeBatchIds.slice(0, 2)) {
      await reviewCard(cardId, 4)
    }

    const refreshedDeck = (await db.decks.get(deck.id))!
    const passiveQueue = await getReviewQueueFullDay(
      refreshedDeck,
      new Date(),
      { introduceNewCards: false }
    )

    expect(passiveQueue.newCards.map((card) => card.frontText)).toEqual(['session 2', 'session 3'])
    expect((await db.decks.get(deck.id))!.currentBatchCardIds).toEqual(activeBatchIds)
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

describe('getReviewDayKey', () => {
  it('uses the current local date after the deck day-start hour', () => {
    expect(getReviewDayKey(new Date('2025-06-02T10:00:00'), 9)).toBe('2025-06-02')
  })

  it('uses the previous local date before the deck day-start hour', () => {
    expect(getReviewDayKey(new Date('2025-06-02T08:00:00'), 9)).toBe('2025-06-01')
  })
})
