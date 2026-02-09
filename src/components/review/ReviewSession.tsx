import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { reviewCard, getReviewQueue, getDueCards, getNextLearningDue, getSchedulingPreview, formatInterval } from '../../services/review'
import { lookupConjugation } from '../../services/conjugationLookup'
import { hydrateConjugation } from '../../services/llm'
import { updateCard } from '../../services/card'
import { maybeAutoAddConjugationCard } from '../../services/conjugationAutoAdd'
import { getDeck } from '../../services/deck'
import ConjugationView from '../cards/ConjugationView'
import type { Deck, Card, VerbData } from '../../types'

interface Props {
  deck: Deck
  onComplete: () => void
}

/** Get the target-language word (Spanish) from a card regardless of direction */
function getTargetWord(card: Card): string {
  return card.direction === 'source-to-target' ? card.backText : card.frontText
}

/**
 * Try to look up conjugation data for a card from the static DB.
 * Tries both frontText and backText since imported/both-direction cards
 * may have the Spanish word in backText regardless of direction.
 */
async function tryConjugationLookup(card: Card): Promise<VerbData | null> {
  // Try the canonical target word first
  const targetWord = getTargetWord(card)
  const result = await lookupConjugation(targetWord)
  if (result) return result

  // Fallback: try the other text field (handles imported cards where
  // both directions share the same frontText/backText layout)
  const otherWord = card.direction === 'source-to-target' ? card.frontText : card.backText
  if (otherWord !== targetWord) {
    return lookupConjugation(otherWord)
  }

  return null
}

export default function ReviewSession({ deck, onComplete }: Props) {
  const [queue, setQueue] = useState<Card[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [totalDue, setTotalDue] = useState(0)
  const [totalNew, setTotalNew] = useState(0)
  const [reviewed, setReviewed] = useState(0)
  const [lookedUpVerbData, setLookedUpVerbData] = useState<VerbData | null>(null)
  const [hydratingReview, setHydratingReview] = useState(false)
  const [hydrateMessage, setHydrateMessage] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [waitingUntil, setWaitingUntil] = useState<Date | null>(null)

  const gradingRef = useRef(false)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentCard = queue[currentIndex]

  const showToast = (message: string) => {
    setToast(message)
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000)
  }

  // Cleanup toast timeout on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    }
  }, [])

  // Auto-lookup conjugation from static DB when a card is revealed
  useEffect(() => {
    if (!currentCard || !revealed) {
      setLookedUpVerbData(null)
      setHydrateMessage('')
      return
    }

    // If card already has verbData (from LLM hydration), no need to look up
    if (currentCard.verbData) {
      setLookedUpVerbData(null)
      return
    }

    // Try looking up any card in the static conjugation DB
    // (no verb-tag gate — this handles imported cards without tags and
    // cards where the Spanish word may be in either text field)
    tryConjugationLookup(currentCard).then((data) => {
      setLookedUpVerbData(data)
    })
  }, [currentCard, revealed])

  // The verb data to display: prefer card's own verbData, fall back to static lookup
  const displayVerbData = currentCard?.verbData ?? lookedUpVerbData

  const handleReviewHydrate = async () => {
    if (!currentCard) return
    setHydratingReview(true)
    setHydrateMessage('')
    try {
      // Try target word first, then the other text field as fallback
      const targetWord = getTargetWord(currentCard)
      let verbData = await hydrateConjugation(targetWord)
      if (verbData === null) {
        const otherWord = currentCard.direction === 'source-to-target'
          ? currentCard.frontText : currentCard.backText
        if (otherWord !== targetWord) {
          verbData = await hydrateConjugation(otherWord)
        }
      }
      if (verbData === null) {
        setHydrateMessage('Not a verb, or not found.')
        return
      }
      // Save to card and update local state
      await updateCard(currentCard.id, { verbData })
      setLookedUpVerbData(verbData)
    } catch (e) {
      setHydrateMessage(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setHydratingReview(false)
    }
  }

  // Compute scheduling preview for the current card when revealed
  const schedulingPreview = useMemo(() => {
    if (!currentCard || !revealed) return null
    const now = new Date()
    const dueDates = getSchedulingPreview(currentCard, now)
    return {
      1: formatInterval(now, dueDates[1]),
      2: formatInterval(now, dueDates[2]),
      3: formatInterval(now, dueDates[3]),
      4: formatInterval(now, dueDates[4]),
    }
  }, [currentCard, revealed])

  // Keyboard shortcuts: space to reveal, 1-4 to grade
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (gradingRef.current) return
      if (!queue[currentIndex]) return

      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        setRevealed(true)
      } else if (revealed && e.key >= '1' && e.key <= '4') {
        e.preventDefault()
        gradingRef.current = true
        handleGrade(parseInt(e.key)).finally(() => {
          gradingRef.current = false
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const loadQueue = useCallback(async () => {
    setLoading(true)
    const { dueCards, newCards } = await getReviewQueue(deck)
    setTotalDue(dueCards.length)
    setTotalNew(newCards.length)

    // Interleave: show some new cards among due cards
    const combined = [...dueCards, ...newCards]
    setQueue(combined)
    setCurrentIndex(0)
    setRevealed(false)
    setReviewed(0)
    setLoading(false)
  }, [deck])

  useEffect(() => {
    loadQueue()
  }, [loadQueue])

  // Check for learning/relearning cards that became due (from "Again" grading)
  const checkForMoreCards = useCallback(async () => {
    const now = new Date()
    const dueNow = await getDueCards(deck.id, now)
    if (dueNow.length > 0) {
      // More cards due (likely from "Again" grading) — continue session
      setQueue(dueNow)
      setCurrentIndex(0)
      setRevealed(false)
      return
    }

    // Check if learning/relearning cards will be due soon
    const nextDue = await getNextLearningDue(deck.id)
    if (nextDue) {
      const waitMs = nextDue.getTime() - now.getTime()
      if (waitMs <= 10 * 60 * 1000) { // Within 10 minutes — wait for them
        setWaitingUntil(nextDue)
        return
      }
    }

    // Truly done — no more cards coming
    onComplete()
    await loadQueue()
  }, [deck.id, onComplete, loadQueue])

  // Timer: poll for due cards while waiting for learning/relearning cards
  useEffect(() => {
    if (!waitingUntil) return
    const interval = setInterval(async () => {
      const now = new Date()
      if (now >= waitingUntil) {
        clearInterval(interval)
        setWaitingUntil(null)
        await checkForMoreCards()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [waitingUntil, checkForMoreCards])

  const handleGrade = async (grade: number) => {
    if (!currentCard) return

    await reviewCard(currentCard.id, grade)
    setReviewed((r) => r + 1)

    // Try auto-adding a conjugation card (fires and handles its own errors)
    try {
      const freshDeck = await getDeck(deck.id)
      if (freshDeck) {
        const result = await maybeAutoAddConjugationCard(currentCard, grade, freshDeck)
        if (result.added && result.form) {
          showToast(`Added: ${result.form}`)
        }
      }
    } catch {
      // Non-critical — don't interrupt review flow
    }

    if (currentIndex + 1 < queue.length) {
      setCurrentIndex((i) => i + 1)
      setRevealed(false)
    } else {
      // Queue exhausted — check for "Again" cards that may now be due
      await checkForMoreCards()
    }
  }

  if (loading) {
    return <p className="text-gray-500 py-8 text-center">Loading review queue...</p>
  }

  if (waitingUntil) {
    const waitMs = Math.max(0, waitingUntil.getTime() - Date.now())
    const waitSec = Math.ceil(waitMs / 1000)
    const waitMin = Math.floor(waitSec / 60)
    const waitSecRem = waitSec % 60
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-lg mb-2">Waiting for next card...</p>
        <p className="text-2xl font-mono text-blue-500">
          {waitMin > 0 ? `${waitMin}m ${waitSecRem}s` : `${waitSec}s`}
        </p>
        <p className="text-gray-400 text-sm mt-2">
          Cards graded "Again" will reappear shortly
        </p>
      </div>
    )
  }

  if (queue.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-lg">No cards to review right now.</p>
        <p className="text-gray-400 text-sm mt-2">
          Add some cards or wait for cards to become due.
        </p>
      </div>
    )
  }

  const remaining = queue.length - currentIndex
  const progress = queue.length > 0 ? (reviewed / queue.length) * 100 : 0
  const displayFront =
    currentCard.direction === 'source-to-target'
      ? currentCard.frontText
      : currentCard.backText
  const displayBack =
    currentCard.direction === 'source-to-target'
      ? currentCard.backText
      : currentCard.frontText

  return (
    <div>
      <div className="flex justify-between text-sm text-gray-500 mb-2">
        <span>{reviewed} reviewed</span>
        <span>
          {remaining} remaining ({totalDue} due, {totalNew} new)
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-4">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-fade-in">
          {toast}
        </div>
      )}

      <div className="bg-white rounded-lg shadow border p-6 text-center min-h-[200px] flex flex-col justify-center">
        <p className="text-2xl font-medium mb-4">{displayFront}</p>

        {currentCard.fsrs.state === 'new' && (
          <span className="inline-block mx-auto mb-3 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            New card
          </span>
        )}

        {revealed ? (
          <>
            <hr className="my-4" />
            <p className="text-xl text-gray-700 mb-6">{displayBack}</p>

            {currentCard.notes && (
              <p className="text-sm text-gray-400 mb-4 italic">{currentCard.notes}</p>
            )}

            {displayVerbData && (
              <ConjugationView
                verbData={displayVerbData}
                enabledConstructs={deck.constructChecklist}
              />
            )}

            {!displayVerbData && !hydratingReview && (
              <button
                onClick={handleReviewHydrate}
                className="text-blue-500 hover:text-blue-700 text-sm underline mb-2"
              >
                Look Up Conjugation
              </button>
            )}

            {hydratingReview && (
              <p className="text-sm text-gray-400 mb-2">Looking up conjugation...</p>
            )}

            {hydrateMessage && (
              <p className="text-sm text-orange-500 mb-2">{hydrateMessage}</p>
            )}

            <div className="grid grid-cols-4 gap-2 mt-4">
              <button
                onClick={() => handleGrade(1)}
                className="bg-red-500 text-white py-3 rounded-lg font-medium text-sm hover:bg-red-600 active:scale-95 transition-transform"
              >
                Again
                <span className="block text-xs opacity-75 mt-0.5">
                  {schedulingPreview ? schedulingPreview[1] : '1'}
                </span>
              </button>
              <button
                onClick={() => handleGrade(2)}
                className="bg-orange-500 text-white py-3 rounded-lg font-medium text-sm hover:bg-orange-600 active:scale-95 transition-transform"
              >
                Hard
                <span className="block text-xs opacity-75 mt-0.5">
                  {schedulingPreview ? schedulingPreview[2] : '2'}
                </span>
              </button>
              <button
                onClick={() => handleGrade(3)}
                className="bg-green-500 text-white py-3 rounded-lg font-medium text-sm hover:bg-green-600 active:scale-95 transition-transform"
              >
                Good
                <span className="block text-xs opacity-75 mt-0.5">
                  {schedulingPreview ? schedulingPreview[3] : '3'}
                </span>
              </button>
              <button
                onClick={() => handleGrade(4)}
                className="bg-blue-500 text-white py-3 rounded-lg font-medium text-sm hover:bg-blue-600 active:scale-95 transition-transform"
              >
                Easy
                <span className="block text-xs opacity-75 mt-0.5">
                  {schedulingPreview ? schedulingPreview[4] : '4'}
                </span>
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => setRevealed(true)}
            className="mt-4 bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-200 active:scale-95 transition-transform"
          >
            Show Answer
            <span className="block text-xs text-gray-400 mt-0.5">Space or Enter</span>
          </button>
        )}
      </div>
    </div>
  )
}
