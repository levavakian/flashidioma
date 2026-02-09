import {
  fsrs,
  createEmptyCard,
  Rating,
  State,
  type Card as FSRSCard,
  type Grade,
} from 'ts-fsrs'
import { db } from '../db'
import type { Card, Deck, FSRSState, ReviewHistory } from '../types'

const scheduler = fsrs()

function cardToFSRS(card: Card): FSRSCard {
  return {
    due: new Date(card.fsrs.dueDate),
    stability: card.fsrs.stability,
    difficulty: card.fsrs.difficulty,
    elapsed_days: card.fsrs.elapsedDays,
    scheduled_days: card.fsrs.scheduledDays,
    reps: card.fsrs.reps,
    lapses: card.fsrs.lapses,
    state: stateToFSRS(card.fsrs.state),
    last_review: card.fsrs.lastReview ? new Date(card.fsrs.lastReview) : undefined,
    learning_steps: 0,
  }
}

function stateToFSRS(state: FSRSState['state']): State {
  switch (state) {
    case 'new': return State.New
    case 'learning': return State.Learning
    case 'review': return State.Review
    case 'relearning': return State.Relearning
  }
}

function fsrsStateToOurs(state: State): FSRSState['state'] {
  switch (state) {
    case State.New: return 'new'
    case State.Learning: return 'learning'
    case State.Review: return 'review'
    case State.Relearning: return 'relearning'
  }
}

function fsrsCardToState(fsrsCard: FSRSCard): FSRSState {
  return {
    stability: fsrsCard.stability,
    difficulty: fsrsCard.difficulty,
    dueDate: fsrsCard.due.toISOString(),
    lastReview: fsrsCard.last_review ? fsrsCard.last_review.toISOString() : null,
    reviewCount: fsrsCard.reps,
    lapses: fsrsCard.lapses,
    state: fsrsStateToOurs(fsrsCard.state),
    elapsedDays: fsrsCard.elapsed_days,
    scheduledDays: fsrsCard.scheduled_days,
    reps: fsrsCard.reps,
  }
}

export function gradeToRating(grade: number): Grade {
  switch (grade) {
    case 1: return Rating.Again
    case 2: return Rating.Hard
    case 3: return Rating.Good
    case 4: return Rating.Easy
    default: throw new Error(`Invalid grade: ${grade}`)
  }
}

/** Get today's date string in YYYY-MM-DD format */
function todayString(now: Date = new Date()): string {
  return now.toISOString().split('T')[0]
}

/** Get remaining daily new card slots for a deck, resetting if day changed */
async function getDailyNewCardRemaining(deck: Deck, now: Date = new Date()): Promise<number> {
  const today = todayString(now)
  const perDay = deck.newCardsPerDay ?? 20

  if (deck.lastNewCardDate !== today) {
    // New day: reset counter
    await db.decks.update(deck.id, {
      newCardsIntroducedToday: 0,
      lastNewCardDate: today,
    })
    return perDay
  }

  const introduced = deck.newCardsIntroducedToday ?? 0
  return Math.max(0, perDay - introduced)
}

/** Increment the daily new card counter for a deck */
export async function incrementDailyNewCardCount(deckId: string, count: number = 1): Promise<void> {
  const deck = await db.decks.get(deckId)
  if (!deck) return

  const today = todayString()
  if (deck.lastNewCardDate !== today) {
    await db.decks.update(deckId, {
      newCardsIntroducedToday: count,
      lastNewCardDate: today,
    })
  } else {
    await db.decks.update(deckId, {
      newCardsIntroducedToday: (deck.newCardsIntroducedToday ?? 0) + count,
    })
  }
}

export async function reviewCard(
  cardId: string,
  grade: number,
  now: Date = new Date()
): Promise<Card> {
  const card = await db.cards.get(cardId)
  if (!card) throw new Error(`Card not found: ${cardId}`)

  const wasNew = card.fsrs.state === 'new'
  const previousState = { ...card.fsrs }
  const fsrsCard = cardToFSRS(card)
  const rating = gradeToRating(grade)

  const result = scheduler.repeat(fsrsCard, now)
  const chosen = result[rating]

  const newFsrsState = fsrsCardToState(chosen.card)

  const reviewHistoryEntry: ReviewHistory = {
    id: crypto.randomUUID(),
    cardId: card.id,
    deckId: card.deckId,
    grade,
    reviewedAt: now.toISOString(),
    previousState,
    newState: newFsrsState,
  }

  const updatedCard = { ...card, fsrs: newFsrsState }

  await db.transaction('rw', [db.cards, db.reviewHistory, db.decks], async () => {
    await db.cards.put(updatedCard)
    await db.reviewHistory.put(reviewHistoryEntry)

    // If the card was new and is now moving out of 'new' state, track it for daily limit
    if (wasNew && newFsrsState.state !== 'new') {
      await incrementDailyNewCardCount(card.deckId)
    }
  })

  return updatedCard
}

export async function getDueCards(
  deckId: string,
  now: Date = new Date()
): Promise<Card[]> {
  const cards = await db.cards.where('deckId').equals(deckId).toArray()
  return cards.filter((card) => {
    if (card.fsrs.state === 'new') return false
    return new Date(card.fsrs.dueDate) <= now
  })
}

export async function getNewCards(deckId: string): Promise<Card[]> {
  const cards = await db.cards.where('deckId').equals(deckId).toArray()
  return cards.filter((c) => c.fsrs.state === 'new')
}

function sortByFrequency(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder
    if (a.sortOrder !== undefined) return -1
    if (b.sortOrder !== undefined) return 1
    return a.createdAt.localeCompare(b.createdAt)
  })
}

/**
 * Get the next batch of new cards to introduce (Anki-like daily limit).
 * Uses newCardsPerDay to cap how many new cards are shown per day.
 * Manual/practice cards count against this daily limit.
 */
export async function getNewCardBatch(deck: Deck, now: Date = new Date()): Promise<Card[]> {
  const remaining = await getDailyNewCardRemaining(deck, now)
  if (remaining <= 0) return []

  // Check if current batch is still pending
  if (deck.currentBatchCardIds.length > 0) {
    const batchCards = await Promise.all(
      deck.currentBatchCardIds.map((id) => db.cards.get(id))
    )
    const existingCards = batchCards.filter((c): c is Card => c !== undefined)
    const stillNew = existingCards.filter((c) => c.fsrs.state === 'new')

    if (stillNew.length > 0) {
      // Current batch still has unreviewed cards, return up to remaining limit
      return sortByFrequency(stillNew).slice(0, remaining)
    }
  }

  // Current batch is complete (or empty), introduce next batch
  const newCards = sortByFrequency(await getNewCards(deck.id))
  if (newCards.length === 0) return []

  const batchSize = Math.min(remaining, deck.newCardBatchSize ?? 5)
  const batch = newCards.slice(0, batchSize)
  const batchIds = batch.map((c) => c.id)

  // Update deck with new batch IDs
  await db.decks.update(deck.id, { currentBatchCardIds: batchIds })

  return batch
}

export async function getReviewQueue(
  deck: Deck,
  now: Date = new Date()
): Promise<{ dueCards: Card[]; newCards: Card[] }> {
  const dueCards = await getDueCards(deck.id, now)
  const newCards = await getNewCardBatch(deck, now)
  return { dueCards, newCards }
}

/**
 * Get the earliest due date among learning/relearning cards in a deck.
 * Returns null if no learning/relearning cards exist.
 * Used to determine if "Again" cards will become due soon in the current session.
 */
export async function getNextLearningDue(deckId: string): Promise<Date | null> {
  const cards = await db.cards.where('deckId').equals(deckId).toArray()
  const learningCards = cards.filter(c =>
    c.fsrs.state === 'learning' || c.fsrs.state === 'relearning'
  )
  if (learningCards.length === 0) return null
  const earliest = Math.min(...learningCards.map(c => new Date(c.fsrs.dueDate).getTime()))
  return new Date(earliest)
}

export function createNewFSRSCard(): FSRSState {
  const empty = createEmptyCard()
  return fsrsCardToState(empty)
}

/**
 * Get a preview of what each grade would schedule for a given card.
 * Returns the due date for each grade (1=Again, 2=Hard, 3=Good, 4=Easy)
 * without actually saving anything.
 */
export function getSchedulingPreview(
  card: Card,
  now: Date = new Date()
): Record<number, Date> {
  const fsrsCard = cardToFSRS(card)
  const result = scheduler.repeat(fsrsCard, now)
  return {
    1: result[Rating.Again].card.due,
    2: result[Rating.Hard].card.due,
    3: result[Rating.Good].card.due,
    4: result[Rating.Easy].card.due,
  }
}

/**
 * Format the interval between now and a due date as a human-readable string.
 * Examples: "<1m", "10m", "1h", "1d", "4d", "2mo", "1y"
 */
export function formatInterval(now: Date, due: Date): string {
  const diffMs = due.getTime() - now.getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return '<1m'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo`
  const years = Math.round(days / 365)
  return `${years}y`
}
