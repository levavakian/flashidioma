import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../src/db'
import { createDeck } from '../../src/services/deck'
import { createCard } from '../../src/services/card'
import {
  reviewCard,
  getDueCards,
  getNewCards,
  getNewCardBatch,
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
})
