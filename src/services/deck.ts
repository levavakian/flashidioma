import { db } from '../db'
import type { Deck, ConstructChecklist } from '../types'
import { getDefaultSpanishChecklist } from '../languages/spanish'

/** Apply default values for Phase 13 fields to decks created before v2 */
function applyDeckDefaults(deck: Deck): Deck {
  return {
    ...deck,
    autoAddConjugations: deck.autoAddConjugations ?? true,
    maxConjugationCardsPerDay: deck.maxConjugationCardsPerDay ?? 5,
    conjugationCardsAddedToday: deck.conjugationCardsAddedToday ?? 0,
    lastConjugationCardDate: deck.lastConjugationCardDate ?? null,
  }
}

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
    autoAddConjugations: true,
    maxConjugationCardsPerDay: 5,
    conjugationCardsAddedToday: 0,
    lastConjugationCardDate: null,
  }

  await db.decks.put(deck)
  return deck
}

export async function getDeck(id: string): Promise<Deck | undefined> {
  const deck = await db.decks.get(id)
  return deck ? applyDeckDefaults(deck) : undefined
}

export async function getAllDecks(): Promise<Deck[]> {
  const decks = await db.decks.toArray()
  return decks.map(applyDeckDefaults)
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

/**
 * Skip forward one day: shift all card due dates back by 24 hours
 * and reset daily counters, making tomorrow's cards available today.
 */
export async function skipForwardOneDay(id: string): Promise<void> {
  const DAY_MS = 24 * 60 * 60 * 1000

  await db.transaction('rw', [db.decks, db.cards], async () => {
    // Shift all card due dates and last review dates back by 24 hours
    const cards = await db.cards.where('deckId').equals(id).toArray()
    for (const card of cards) {
      const updatedCard = {
        ...card,
        fsrs: {
          ...card.fsrs,
          dueDate: new Date(new Date(card.fsrs.dueDate).getTime() - DAY_MS).toISOString(),
          lastReview: card.fsrs.lastReview
            ? new Date(new Date(card.fsrs.lastReview).getTime() - DAY_MS).toISOString()
            : null,
        },
      }
      await db.cards.put(updatedCard)
    }

    // Reset daily counters as if a new day started
    await db.decks.update(id, {
      newCardsIntroducedToday: 0,
      lastNewCardDate: null,
      conjugationCardsAddedToday: 0,
      lastConjugationCardDate: null,
    })
  })
}

export async function deleteDeck(id: string): Promise<void> {
  await db.transaction('rw', [db.decks, db.cards, db.practiceSentences, db.reviewHistory, db.conjugationAutoAdds], async () => {
    await db.cards.where('deckId').equals(id).delete()
    await db.practiceSentences.where('deckId').equals(id).delete()
    await db.reviewHistory.where('deckId').equals(id).delete()
    await db.conjugationAutoAdds.where('deckId').equals(id).delete()
    await db.decks.delete(id)
  })
}
