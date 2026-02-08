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

export async function reviewCard(
  cardId: string,
  grade: number,
  now: Date = new Date()
): Promise<Card> {
  const card = await db.cards.get(cardId)
  if (!card) throw new Error(`Card not found: ${cardId}`)

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

  await db.transaction('rw', [db.cards, db.reviewHistory], async () => {
    await db.cards.put(updatedCard)
    await db.reviewHistory.put(reviewHistoryEntry)
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

/**
 * Get the next batch of new cards to introduce.
 * New cards are gated: the next batch is only introduced after the current batch
 * has been fully reviewed (all cards moved out of 'new' state).
 */
export async function getNewCardBatch(deck: Deck): Promise<Card[]> {
  // Check if current batch is still pending
  if (deck.currentBatchCardIds.length > 0) {
    const batchCards = await Promise.all(
      deck.currentBatchCardIds.map((id) => db.cards.get(id))
    )
    const existingCards = batchCards.filter((c): c is Card => c !== undefined)
    const stillNew = existingCards.filter((c) => c.fsrs.state === 'new')

    if (stillNew.length > 0) {
      // Current batch still has unreviewed cards, return those
      return stillNew
    }
  }

  // Current batch is complete (or empty), introduce next batch
  const newCards = await getNewCards(deck.id)
  if (newCards.length === 0) return []

  const batch = newCards.slice(0, deck.newCardBatchSize)
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
  const newCards = await getNewCardBatch(deck)
  return { dueCards, newCards }
}

export function createNewFSRSCard(): FSRSState {
  const empty = createEmptyCard()
  return fsrsCardToState(empty)
}
