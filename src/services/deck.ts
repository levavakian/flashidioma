import { db } from '../db'
import type { Deck, ConstructChecklist } from '../types'
import { getDefaultSpanishChecklist } from '../languages/spanish'

export async function createDeck(
  name: string,
  targetLanguage: string = 'spanish'
): Promise<Deck> {
  let checklist: ConstructChecklist = {}
  if (targetLanguage === 'spanish') {
    checklist = getDefaultSpanishChecklist()
  }

  const deck: Deck = {
    id: crypto.randomUUID(),
    name,
    targetLanguage,
    createdAt: new Date().toISOString(),
    constructChecklist: checklist,
    newCardBatchSize: 5,
    currentBatchCardIds: [],
    newCardsPerDay: 20,
    newCardsIntroducedToday: 0,
    lastNewCardDate: null,
  }

  await db.decks.put(deck)
  return deck
}

export async function getDeck(id: string): Promise<Deck | undefined> {
  return db.decks.get(id)
}

export async function getAllDecks(): Promise<Deck[]> {
  return db.decks.toArray()
}

export async function updateDeck(
  id: string,
  updates: Partial<Omit<Deck, 'id' | 'createdAt'>>
): Promise<Deck> {
  const deck = await db.decks.get(id)
  if (!deck) throw new Error(`Deck not found: ${id}`)

  const updated = { ...deck, ...updates }
  await db.decks.put(updated)
  return updated
}

export async function deleteDeck(id: string): Promise<void> {
  await db.transaction('rw', [db.decks, db.cards, db.practiceSentences, db.reviewHistory], async () => {
    await db.cards.where('deckId').equals(id).delete()
    await db.practiceSentences.where('deckId').equals(id).delete()
    await db.reviewHistory.where('deckId').equals(id).delete()
    await db.decks.delete(id)
  })
}
