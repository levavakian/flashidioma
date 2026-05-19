import { db } from '../db'
import type { Card, Deck, ConstructChecklist } from '../types'
import { getDefaultSpanishChecklist } from '../languages/spanish'
import { getDayBoundary, getReviewDayKey } from './review'

function getDeckDefaults(deck: Partial<Deck>): Omit<Deck, 'id' | 'name' | 'createdAt'> {
  const targetLanguage = deck.targetLanguage ?? 'spanish'
  return {
    targetLanguage,
    constructChecklist: deck.constructChecklist ?? (targetLanguage === 'spanish' ? getDefaultSpanishChecklist() : {}),
    newCardBatchSize: deck.newCardBatchSize ?? 5,
    currentBatchCardIds: Array.isArray(deck.currentBatchCardIds) ? deck.currentBatchCardIds : [],
    newCardsPerDay: deck.newCardsPerDay ?? 20,
    newCardsIntroducedToday: deck.newCardsIntroducedToday ?? 0,
    lastNewCardDate: deck.lastNewCardDate ?? null,
    autoAddConjugations: deck.autoAddConjugations ?? true,
    maxConjugationCardsPerDay: deck.maxConjugationCardsPerDay ?? 5,
    conjugationCardsStartLearning: deck.conjugationCardsStartLearning ?? false,
    conjugationCardsAddedToday: deck.conjugationCardsAddedToday ?? 0,
    lastConjugationCardDate: deck.lastConjugationCardDate ?? null,
    dayStartHour: deck.dayStartHour ?? 9,
    requestRetention: deck.requestRetention ?? 0.9,
  }
}

/** Apply default values for decks created by older app versions. */
export function applyDeckDefaults(deck: Deck): Deck {
  const defaults = getDeckDefaults(deck)
  return {
    ...deck,
    ...defaults,
  }
}

function sortCardsForReviewQueue(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder
    if (a.sortOrder !== undefined) return -1
    if (b.sortOrder !== undefined) return 1
    return a.createdAt.localeCompare(b.createdAt)
  })
}

async function recomputeActiveNewCardSet(deck: Deck, now: Date = new Date()): Promise<{
  cardIds: string[]
  limitedCount: number
}> {
  const cutoff = getDayBoundary(now, deck.dayStartHour ?? 9)
  const newCards = (await db.cards.where('deckId').equals(deck.id).toArray())
    .filter((card) => card.fsrs.state === 'new')
    .filter((card) => new Date(card.fsrs.dueDate) <= cutoff)

  const limitedCards = sortCardsForReviewQueue(
    newCards.filter((card) => card.source !== 'auto-conjugation')
  ).slice(0, deck.newCardsPerDay)
  const freeCards = sortCardsForReviewQueue(
    newCards.filter((card) => card.source === 'auto-conjugation')
  )

  return {
    cardIds: [...limitedCards, ...freeCards].map((card) => card.id),
    limitedCount: limitedCards.length,
  }
}

export async function repairDeckSchema(id: string): Promise<{ changed: boolean; changes: string[]; deck: Deck }> {
  const deck = await db.decks.get(id)
  if (!deck) throw new Error(`Deck not found: ${id}`)

  const repaired = applyDeckDefaults(deck)
  const changes: string[] = []

  for (const key of Object.keys(repaired) as (keyof Deck)[]) {
    if (JSON.stringify(deck[key]) !== JSON.stringify(repaired[key])) {
      changes.push(String(key))
    }
  }

  const recomputedNewSet = await recomputeActiveNewCardSet(repaired)
  const today = getReviewDayKey(new Date(), repaired.dayStartHour ?? 9)

  if (JSON.stringify(repaired.currentBatchCardIds) !== JSON.stringify(recomputedNewSet.cardIds)) {
    repaired.currentBatchCardIds = recomputedNewSet.cardIds
    if (!changes.includes('currentBatchCardIds')) changes.push('currentBatchCardIds')
  }
  if (repaired.newCardsIntroducedToday !== recomputedNewSet.limitedCount) {
    repaired.newCardsIntroducedToday = recomputedNewSet.limitedCount
    if (!changes.includes('newCardsIntroducedToday')) changes.push('newCardsIntroducedToday')
  }
  if (recomputedNewSet.limitedCount > 0 && repaired.lastNewCardDate !== today) {
    repaired.lastNewCardDate = today
    if (!changes.includes('lastNewCardDate')) changes.push('lastNewCardDate')
  }

  if (changes.length > 0) {
    await db.decks.put(repaired)
  }

  return { changed: changes.length > 0, changes, deck: repaired }
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
    conjugationCardsStartLearning: false,
    conjugationCardsAddedToday: 0,
    lastConjugationCardDate: null,
    dayStartHour: 9,
    requestRetention: 0.9,
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
