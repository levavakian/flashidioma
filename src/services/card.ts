import { db } from '../db'
import { incrementDailyNewCardCount, createLearningFSRSCard } from './review'
import type { Card, CardDirection, FSRSState } from '../types'

function newFSRSState(): FSRSState {
  return {
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
  }
}


export interface CreateCardInput {
  deckId: string
  frontText: string
  backText: string
  direction: CardDirection
  tags?: string[]
  notes?: string
  source?: Card['source']
  sortOrder?: number
  verbData?: Card['verbData']
}

export async function createCard(input: CreateCardInput): Promise<Card> {
  // Auto-conjugation cards start as "learning" so they're immediately
  // available for review without consuming a "new card" slot
  const isAutoConj = input.source === 'auto-conjugation'

  const card: Card = {
    id: crypto.randomUUID(),
    deckId: input.deckId,
    frontText: input.frontText,
    backText: input.backText,
    direction: input.direction,
    tags: input.tags ?? [],
    notes: input.notes ?? '',
    fsrs: isAutoConj ? createLearningFSRSCard() : newFSRSState(),
    createdAt: new Date().toISOString(),
    source: input.source ?? 'manual',
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    ...(input.verbData ? { verbData: input.verbData } : {}),
  }

  await db.cards.put(card)

  // Manual and practice cards count against the daily new card limit
  // Auto-conjugation cards do NOT count (they start as "learning")
  if (card.source === 'manual' || card.source === 'practice') {
    await incrementDailyNewCardCount(card.deckId)
  }

  return card
}

export async function createCardBothDirections(
  input: Omit<CreateCardInput, 'direction'>
): Promise<[Card, Card]> {
  const card1 = await createCard({ ...input, direction: 'source-to-target' })
  const card2 = await createCard({ ...input, direction: 'target-to-source' })
  return [card1, card2]
}

export async function getCard(id: string): Promise<Card | undefined> {
  return db.cards.get(id)
}

export async function getCardsByDeck(deckId: string): Promise<Card[]> {
  return db.cards.where('deckId').equals(deckId).toArray()
}

export async function updateCard(
  id: string,
  updates: Partial<Omit<Card, 'id' | 'deckId' | 'createdAt'>>
): Promise<Card> {
  const card = await db.cards.get(id)
  if (!card) throw new Error(`Card not found: ${id}`)

  const updated = { ...card, ...updates }
  await db.cards.put(updated)
  return updated
}

export async function deleteCard(id: string): Promise<void> {
  await db.transaction('rw', [db.cards, db.reviewHistory], async () => {
    await db.reviewHistory.where('cardId').equals(id).delete()
    await db.cards.delete(id)
  })
}

export async function searchCards(
  deckId: string,
  query: string,
  tags?: string[]
): Promise<Card[]> {
  let cards = await getCardsByDeck(deckId)

  if (query) {
    const lower = query.toLowerCase()
    cards = cards.filter(
      (c) =>
        c.frontText.toLowerCase().includes(lower) ||
        c.backText.toLowerCase().includes(lower)
    )
  }

  if (tags && tags.length > 0) {
    cards = cards.filter((c) => tags.some((t) => c.tags.includes(t)))
  }

  return cards
}
