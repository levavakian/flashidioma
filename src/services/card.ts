import { db } from '../db'
import { incrementDailyNewCardCount, createLearningFSRSCard } from './review'
import { lookupConjugation } from './conjugationLookup'
import type { Card, CardDirection, CardExample, FSRSState } from '../types'

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
  // Auto-lookup conjugation data from static DB if not provided
  // Try backText first (usually the target/Spanish word), then frontText as fallback
  let verbData = input.verbData
  if (!verbData) {
    verbData = (await lookupConjugation(input.backText)) ?? (await lookupConjugation(input.frontText)) ?? undefined
  }
  const withVerb = verbData ? { ...input, verbData } : input
  const card1 = await createCard({ ...withVerb, direction: 'source-to-target' })
  const card2 = await createCard({ ...withVerb, direction: 'target-to-source' })
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

export async function addExampleToCard(cardId: string, example: CardExample): Promise<void> {
  const card = await db.cards.get(cardId)
  if (!card) return
  const examples = card.examples ?? []
  examples.push(example)
  await db.cards.update(cardId, { examples })
}

export async function removeExampleFromCard(cardId: string, exampleId: string): Promise<void> {
  const card = await db.cards.get(cardId)
  if (!card || !card.examples) return
  const examples = card.examples.filter(e => e.id !== exampleId)
  await db.cards.update(cardId, { examples })
}

/** Find companion card (same text pair, opposite direction) */
function findCompanionCard(cards: Card[], card: Card): Card | undefined {
  return cards.find(c =>
    c.id !== card.id &&
    c.frontText === card.frontText &&
    c.backText === card.backText &&
    c.direction !== card.direction
  )
}

export async function addExampleToCardAndCompanions(
  deckId: string,
  cardId: string,
  example: CardExample
): Promise<void> {
  const allCards = await getCardsByDeck(deckId)
  const card = allCards.find(c => c.id === cardId)
  if (!card) return

  await addExampleToCard(cardId, example)

  const companion = findCompanionCard(allCards, card)
  if (companion) {
    await addExampleToCard(companion.id, example)
  }
}

export async function removeExampleFromCardAndCompanions(
  deckId: string,
  cardId: string,
  exampleId: string
): Promise<void> {
  const allCards = await getCardsByDeck(deckId)
  const card = allCards.find(c => c.id === cardId)
  if (!card) return

  await removeExampleFromCard(cardId, exampleId)

  const companion = findCompanionCard(allCards, card)
  if (companion) {
    await removeExampleFromCard(companion.id, exampleId)
  }
}
