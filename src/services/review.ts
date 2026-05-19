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

const DEFAULT_RETENTION = 0.9
const schedulerCache = new Map<number, ReturnType<typeof fsrs>>()

function getScheduler(requestRetention: number = DEFAULT_RETENTION): ReturnType<typeof fsrs> {
  let cached = schedulerCache.get(requestRetention)
  if (!cached) {
    cached = fsrs({ request_retention: requestRetention })
    schedulerCache.set(requestRetention, cached)
  }
  return cached
}

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
    learning_steps: card.fsrs.learningSteps ?? 0,
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
    learningSteps: fsrsCard.learning_steps,
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

function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Get the local review-day key for daily limits. */
export function getReviewDayKey(now: Date = new Date(), dayStartHour: number = 9): string {
  const reviewDayStart = new Date(now)
  reviewDayStart.setHours(dayStartHour, 0, 0, 0)
  if (now < reviewDayStart) {
    reviewDayStart.setDate(reviewDayStart.getDate() - 1)
  }
  return formatLocalDateKey(reviewDayStart)
}

/** Get remaining daily new card slots for a deck, resetting if day changed */
async function getDailyNewCardRemaining(deckId: string, now: Date = new Date()): Promise<number> {
  const deck = await db.decks.get(deckId)
  if (!deck) return 0

  const today = getReviewDayKey(now, deck.dayStartHour ?? 9)
  const perDay = deck.newCardsPerDay ?? 20

  if (deck.lastNewCardDate !== today) {
    // New day: reset counter
    await db.decks.update(deckId, {
      newCardsIntroducedToday: 0,
      lastNewCardDate: today,
    })
    return perDay
  }

  const introduced = deck.newCardsIntroducedToday ?? 0
  return Math.max(0, perDay - introduced)
}

function getDailyNewCardRemainingFromDeck(deck: Deck, now: Date = new Date()): number {
  const today = getReviewDayKey(now, deck.dayStartHour ?? 9)
  const introduced = deck.lastNewCardDate === today ? (deck.newCardsIntroducedToday ?? 0) : 0
  return Math.max(0, (deck.newCardsPerDay ?? 20) - introduced)
}

function countLimitedNewCards(cards: Card[]): number {
  return cards.filter((card) => card.source !== 'auto-conjugation').length
}

function isNewCardInReviewDay(card: Card, cutoff: Date): boolean {
  return card.fsrs.state === 'new' && new Date(card.fsrs.dueDate) <= cutoff
}

async function setDailyNewCardCountAtLeast(deckId: string, count: number, now: Date = new Date()): Promise<void> {
  const deck = await db.decks.get(deckId)
  if (!deck) return

  const today = getReviewDayKey(now, deck.dayStartHour ?? 9)
  const current = deck.lastNewCardDate === today ? (deck.newCardsIntroducedToday ?? 0) : 0
  if (deck.lastNewCardDate === today && current >= count) return

  await db.decks.update(deckId, {
    newCardsIntroducedToday: Math.max(current, count),
    lastNewCardDate: today,
  })
}

/** Increment the daily new card counter when cards are introduced into the review queue. */
export async function incrementDailyNewCardCount(
  deckId: string,
  count: number = 1,
  now: Date = new Date()
): Promise<void> {
  const deck = await db.decks.get(deckId)
  if (!deck || count < 0) return

  const today = getReviewDayKey(now, deck.dayStartHour ?? 9)
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
  now: Date = new Date(),
  requestRetention: number = DEFAULT_RETENTION
): Promise<Card> {
  const card = await db.cards.get(cardId)
  if (!card) throw new Error(`Card not found: ${cardId}`)

  const previousState = { ...card.fsrs }
  const fsrsCard = cardToFSRS(card)
  const rating = gradeToRating(grade)

  const result = getScheduler(requestRetention).repeat(fsrsCard, now)
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

    // Daily new-card limits are consumed when cards are introduced into the queue,
    // not when the user grades them.
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

export function getAutoConjugationNewCardLimit(deck: Pick<Deck, 'maxConjugationCardsPerDay'>): number {
  return Math.max(0, deck.maxConjugationCardsPerDay ?? 5)
}

/**
 * Get the daily set of new cards to introduce.
 * Uses newCardsPerDay to cap how many new cards are shown per review day.
 * Manual/practice cards count against this daily limit.
 * Always reads fresh deck state from the DB so counters are accurate.
 */
export async function getNewCardBatch(
  deck: Deck,
  now: Date = new Date(),
  options: { introduce?: boolean } = {}
): Promise<Card[]> {
  // Re-read the deck from DB to get the latest counters and active daily-set IDs.
  const freshDeck = await db.decks.get(deck.id)
  if (!freshDeck) return []
  const introduce = options.introduce !== false

  // Check if the current daily new-card set is still pending.
  if (freshDeck.currentBatchCardIds.length > 0) {
    const cutoff = getDayBoundary(now, freshDeck.dayStartHour ?? 9)
    const batchCards = await Promise.all(
      freshDeck.currentBatchCardIds.map((id) => db.cards.get(id))
    )
    const existingCards = batchCards.filter((c): c is Card => c !== undefined)
    const stillNew = existingCards.filter((card) => isNewCardInReviewDay(card, cutoff))

    if (stillNew.length > 0) {
      const dailyLimit = freshDeck.newCardsPerDay ?? 20
      const autoConjugationLimit = getAutoConjugationNewCardLimit(freshDeck)
      const activeLimitedCards = sortByFrequency(
        stillNew.filter((card) => card.source !== 'auto-conjugation')
      ).slice(0, dailyLimit)
      const activeFreeCards = sortByFrequency(
        stillNew.filter((card) => card.source === 'auto-conjugation')
      ).slice(0, autoConjugationLimit)
      const normalizedActiveCards = [...activeLimitedCards, ...activeFreeCards]
      const normalizedActiveIds = normalizedActiveCards.map((card) => card.id)

      if (introduce) {
        await db.decks.update(deck.id, { currentBatchCardIds: normalizedActiveIds })
      }

      const activeLimitedCount = activeLimitedCards.length
      if (introduce) {
        await setDailyNewCardCountAtLeast(deck.id, activeLimitedCount, now)
      }
      const remaining = introduce
        ? await getDailyNewCardRemaining(deck.id, now)
        : getDailyNewCardRemainingFromDeck(freshDeck, now)
      const additionalSlots = Math.max(
        0,
        Math.min(dailyLimit - activeLimitedCount, remaining)
      )
      const additionalAutoSlots = Math.max(0, autoConjugationLimit - activeFreeCards.length)
      if (additionalSlots > 0 || additionalAutoSlots > 0) {
        const activeIds = new Set(normalizedActiveIds)
        const newCards = (await getNewCards(deck.id))
          .filter((card) => !activeIds.has(card.id))
          .filter((card) => isNewCardInReviewDay(card, cutoff))
        const additionalLimitedCards = sortByFrequency(
          newCards.filter((card) => card.source !== 'auto-conjugation')
        ).slice(0, additionalSlots)
        const additionalFreeCards = sortByFrequency(
          newCards.filter((card) => card.source === 'auto-conjugation')
        ).slice(0, additionalAutoSlots)
        const additionalCards = [...additionalLimitedCards, ...additionalFreeCards]
        const dailySet = sortByFrequency([...normalizedActiveCards, ...additionalCards])

        if (introduce) {
          await db.decks.update(deck.id, {
            currentBatchCardIds: [
              ...normalizedActiveIds,
              ...additionalCards.map((card) => card.id),
            ],
          })
          await incrementDailyNewCardCount(deck.id, countLimitedNewCards(additionalLimitedCards), now)
        }

        return dailySet
      }

      // Once a daily set is introduced, keep showing it until the user finishes it.
      return sortByFrequency(normalizedActiveCards)
    }

    if (introduce) {
      await db.decks.update(deck.id, { currentBatchCardIds: [] })
    }
    if (freshDeck.lastNewCardDate === getReviewDayKey(now, freshDeck.dayStartHour ?? 9)) {
      return []
    }
  }

  const remaining = introduce
    ? await getDailyNewCardRemaining(deck.id, now)
    : getDailyNewCardRemainingFromDeck(freshDeck, now)
  if (remaining <= 0) return []

  // Current daily set is complete (or empty), introduce the remaining daily allowance at once.
  const cutoff = getDayBoundary(now, freshDeck.dayStartHour ?? 9)
  const eligibleNewCards = (await getNewCards(deck.id)).filter((card) => isNewCardInReviewDay(card, cutoff))
  const limitedCards = sortByFrequency(
    eligibleNewCards.filter((card) => card.source !== 'auto-conjugation')
  ).slice(0, remaining)
  const freeCards = sortByFrequency(
    eligibleNewCards.filter((card) => card.source === 'auto-conjugation')
  ).slice(0, getAutoConjugationNewCardLimit(freshDeck))
  const dailySet = sortByFrequency([...limitedCards, ...freeCards])
  if (dailySet.length === 0) return []

  const dailySetIds = dailySet.map((c) => c.id)

  if (!introduce) {
    return dailySet
  }

  // Keep using the legacy field name for the active daily new-card set.
  await db.decks.update(deck.id, { currentBatchCardIds: dailySetIds })
  await incrementDailyNewCardCount(deck.id, countLimitedNewCards(limitedCards), now)

  return dailySet
}

export async function getReviewQueue(
  deck: Deck,
  now: Date = new Date()
): Promise<{ dueCards: Card[]; newCards: Card[] }> {
  const dueCards = await getDueCards(deck.id, now)
  const newCards = await getNewCardBatch(deck, now)
  return { dueCards, newCards }
}

/** Get all non-new cards due within the next 24 hours */
export async function getDueCardsWithin24h(
  deckId: string,
  now: Date = new Date()
): Promise<Card[]> {
  const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const cards = await db.cards.where('deckId').equals(deckId).toArray()
  return cards.filter((card) => {
    if (card.fsrs.state === 'new') return false
    return new Date(card.fsrs.dueDate) <= cutoff
  })
}

/** Get the earliest due date within the next 24 hours for non-new cards not yet due */
export async function getNextDueWithin24h(
  deckId: string,
  now: Date = new Date()
): Promise<Date | null> {
  const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const cards = await db.cards.where('deckId').equals(deckId).toArray()
  const upcoming = cards.filter((card) => {
    if (card.fsrs.state === 'new') return false
    const due = new Date(card.fsrs.dueDate)
    return due > now && due <= cutoff
  })
  if (upcoming.length === 0) return null
  const earliest = Math.min(...upcoming.map(c => new Date(c.fsrs.dueDate).getTime()))
  return new Date(earliest)
}

/** Get the earliest non-new card due before this deck's review-day boundary */
export async function getNextDueInReviewDay(
  deck: Deck,
  now: Date = new Date()
): Promise<Date | null> {
  const cutoff = getDayBoundary(now, deck.dayStartHour ?? 9)
  const cards = await db.cards.where('deckId').equals(deck.id).toArray()
  const upcoming = cards.filter((card) => {
    if (card.fsrs.state === 'new') return false
    const due = new Date(card.fsrs.dueDate)
    return due > now && due <= cutoff
  })
  if (upcoming.length === 0) return null
  const earliest = Math.min(...upcoming.map(c => new Date(c.fsrs.dueDate).getTime()))
  return new Date(earliest)
}

/**
 * Get the end-of-day boundary for the current review day.
 * The review day starts at dayStartHour (default 9am).
 * If now is past today's start hour, the boundary is tomorrow at that hour.
 * If now is before today's start hour, the boundary is today at that hour.
 */
export function getDayBoundary(now: Date, dayStartHour: number = 9): Date {
  const boundary = new Date(now)
  boundary.setHours(dayStartHour, 0, 0, 0)
  if (now >= boundary) {
    boundary.setDate(boundary.getDate() + 1)
  }
  return boundary
}

/** Full-day review queue: due now + upcoming before day boundary + new cards */
export async function getReviewQueueFullDay(
  deck: Deck,
  now: Date = new Date(),
  options: {
    includeNewCards?: boolean
    includeUpcomingCards?: boolean
    introduceNewCards?: boolean
  } = {}
): Promise<{ dueCards: Card[]; upcomingCards: Card[]; newCards: Card[] }> {
  const freshDeck = await db.decks.get(deck.id)
  const queueDeck = freshDeck ?? deck
  const cutoff = getDayBoundary(now, queueDeck.dayStartHour ?? 9)
  const cards = await db.cards.where('deckId').equals(deck.id).toArray()

  const dueCards = cards.filter((card) => {
    if (card.fsrs.state === 'new') return false
    return new Date(card.fsrs.dueDate) <= now
  })

  const upcomingCards = options.includeUpcomingCards === false
    ? []
    : cards.filter((card) => {
        if (card.fsrs.state === 'new') return false
        const due = new Date(card.fsrs.dueDate)
        return due > now && due <= cutoff
      })

  const newCards = options.includeNewCards === false
    ? []
    : await getNewCardBatch(queueDeck, now, { introduce: options.introduceNewCards !== false })
  return { dueCards, upcomingCards, newCards }
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
 * Create an FSRS state for auto-added conjugation cards.
 * Simulates a first "Again" review on a new card to get valid FSRS values
 * (stability, difficulty) then overrides dueDate to now so the card is
 * immediately available. This avoids NaN scheduling issues from manually
 * constructing a learning state with zero stability/difficulty.
 */
export function createLearningFSRSCard(now: Date = new Date(), requestRetention: number = DEFAULT_RETENTION): FSRSState {
  const empty = createEmptyCard()
  const result = getScheduler(requestRetention).repeat(empty, now)
  const afterReview = result[Rating.Again].card
  const state = fsrsCardToState(afterReview)
  // Override due date to now so the card appears immediately in the review queue
  state.dueDate = now.toISOString()
  return state
}

/**
 * Get a preview of what each grade would schedule for a given card.
 * Returns the due date for each grade (1=Again, 2=Hard, 3=Good, 4=Easy)
 * without actually saving anything.
 */
export function getSchedulingPreview(
  card: Card,
  now: Date = new Date(),
  requestRetention: number = DEFAULT_RETENTION
): Record<number, Date> {
  const fsrsCard = cardToFSRS(card)
  const result = getScheduler(requestRetention).repeat(fsrsCard, now)
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
