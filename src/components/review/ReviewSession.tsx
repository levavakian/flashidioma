import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { reviewCard, getReviewQueueFullDay, getDueCards, getNextDueInReviewDay, getSchedulingPreview, formatInterval } from '../../services/review'
import { lookupConjugation } from '../../services/conjugationLookup'
import { hydrateConjugation } from '../../services/llm'
import { updateCard, deleteCard } from '../../services/card'
import { maybeAutoAddConjugationCard } from '../../services/conjugationAutoAdd'
import { getDeck } from '../../services/deck'
import ConjugationView from '../cards/ConjugationView'
import type { Deck, Card, VerbData } from '../../types'

interface Props {
  deck: Deck
  onComplete: () => void
  onUpdate?: () => void
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

export default function ReviewSession({ deck, onComplete, onUpdate }: Props) {
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
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null)
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [waitingUntil, setWaitingUntil] = useState<Date | null>(null)

  const gradingRef = useRef(false)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dueRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deckRef = useRef(deck)
  const onCompleteRef = useRef(onComplete)
  deckRef.current = deck
  onCompleteRef.current = onComplete

  const currentCard = queue[currentIndex]

  const showToast = (message: string, error = false) => {
    setToast({ message, error })
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000)
  }

  // Cleanup toast timeout on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
      if (dueRefreshTimeoutRef.current) clearTimeout(dueRefreshTimeoutRef.current)
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

  const handleEditCard = (card: Card) => {
    setEditingCard(card)
    setEditFront(card.frontText)
    setEditBack(card.backText)
    setEditNotes(card.notes)
  }

  const handleSaveEdit = async () => {
    if (!editingCard) return
    const updates = {
      frontText: editFront.trim(),
      backText: editBack.trim(),
      notes: editNotes.trim(),
    }
    await updateCard(editingCard.id, updates)
    // Update the card in the queue so the display reflects edits
    setQueue(prev => prev.map(c =>
      c.id === editingCard.id ? { ...c, ...updates } : c
    ))
    setEditingCard(null)
    onUpdate?.()
  }

  const handleDeleteCard = async () => {
    if (!currentCard) return
    if (!confirm(`Delete card "${currentCard.frontText}"?`)) return
    await deleteCard(currentCard.id)
    onUpdate?.()

    // Remove deleted card from queue and advance
    const nextQueue = [...queue.slice(0, currentIndex), ...queue.slice(currentIndex + 1)]
    if (nextQueue.length === 0) {
      setQueue([])
      onComplete()
    } else {
      setQueue(nextQueue)
      setCurrentIndex(Math.min(currentIndex, nextQueue.length - 1))
      setRevealed(false)
    }
  }

  // Compute scheduling preview for the current card when revealed
  const schedulingPreview = useMemo(() => {
    if (!currentCard || !revealed) return null
    const now = new Date()
    const dueDates = getSchedulingPreview(currentCard, now, deck.requestRetention)
    return {
      1: formatInterval(now, dueDates[1]),
      2: formatInterval(now, dueDates[2]),
      3: formatInterval(now, dueDates[3]),
      4: formatInterval(now, dueDates[4]),
    }
  }, [currentCard, revealed, deck.requestRetention])

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

  // Load the queue for the active deck.
  const loadQueue = useCallback(async () => {
    setLoading(true)
    const d = deckRef.current
    const { dueCards, upcomingCards, newCards } = await getReviewQueueFullDay(d)
    setTotalDue(dueCards.length + upcomingCards.length)
    setTotalNew(newCards.length)

    // Load ALL cards for the day upfront: due now + upcoming + new
    const combined = [...dueCards, ...upcomingCards, ...newCards]
    const nextDue = combined.length === 0 ? await getNextDueInReviewDay(d) : null
    setQueue(combined)
    setCurrentIndex(0)
    setRevealed(false)
    setReviewed(0)
    setWaitingUntil(nextDue)
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadQueue()
  }, [deck.id, loadQueue])

  useEffect(() => {
    if (loading || queue.length > 0 || !waitingUntil) return

    let cancelled = false

    const scheduleDueRefresh = async () => {
      const d = deckRef.current
      const now = new Date()
      dueRefreshTimeoutRef.current = setTimeout(async () => {
        dueRefreshTimeoutRef.current = null
        const refreshNow = new Date()
        const dueCards = await getDueCards(d.id, refreshNow)
        if (cancelled) return

        if (dueCards.length === 0) {
          const nextDue = await getNextDueInReviewDay(d, refreshNow)
          if (cancelled) return
          if (nextDue) {
            setWaitingUntil(nextDue)
          } else {
            setWaitingUntil(null)
            onCompleteRef.current()
          }
          return
        }

        setTotalDue(dueCards.length)
        setTotalNew(0)
        setQueue(dueCards)
        setCurrentIndex(0)
        setRevealed(false)
        setWaitingUntil(null)
      }, Math.max(0, waitingUntil.getTime() - now.getTime()))
    }

    void scheduleDueRefresh()

    return () => {
      cancelled = true
      if (dueRefreshTimeoutRef.current) {
        clearTimeout(dueRefreshTimeoutRef.current)
        dueRefreshTimeoutRef.current = null
      }
    }
  }, [deck.id, loading, queue.length, waitingUntil])

  const handleGrade = async (grade: number) => {
    if (!currentCard) return

    const updated = await reviewCard(currentCard.id, grade, new Date(), deck.requestRetention)
    setReviewed((r) => r + 1)

    // Try auto-adding a conjugation card (fires and handles its own errors)
    try {
      const freshDeck = await getDeck(deck.id)
      if (freshDeck) {
        const result = await maybeAutoAddConjugationCard(currentCard, grade, freshDeck)
        if (result.added && result.form) {
          if (result.translationFailed) {
            showToast(`Added: ${result.form} (no connection for translation)`, true)
          } else {
            showToast(`Added: ${result.form}`)
          }
        }
      }
    } catch {
      // Non-critical — don't interrupt review flow
    }

    // Build next queue: remaining cards + requeued card (if due before day boundary)
    const remaining = queue.slice(currentIndex + 1)
    const now = new Date()

    // If the card is already due again, put it back at end of queue.
    // Future learning intervals should wait until they are actually due.
    const requeue = new Date(updated.fsrs.dueDate) <= now
      ? [updated] : []

    // Also check DB for any newly-due cards not in our queue (e.g. auto-added conjugation cards)
    const remainingIds = new Set(remaining.map(c => c.id))
    remainingIds.add(currentCard.id)
    requeue.forEach(c => remainingIds.add(c.id))
    const dueNow = await getDueCards(deck.id, now)
    const newlyDue = dueNow.filter(c => !remainingIds.has(c.id))

    const nextQueue = [...remaining, ...newlyDue, ...requeue]

    if (nextQueue.length > 0) {
      setQueue(nextQueue)
      setCurrentIndex(0)
      setRevealed(false)
      setWaitingUntil(null)
    } else {
      // Do a full reload for cards that became due now, but do not introduce
      // another new-card batch or pull future learning intervals forward.
      const freshDeck = await getDeck(deck.id)
      if (freshDeck) {
        const { dueCards, upcomingCards, newCards } = await getReviewQueueFullDay(
          freshDeck,
          new Date(),
          { includeNewCards: false, includeUpcomingCards: false }
        )
        const fullReload = [...dueCards, ...upcomingCards, ...newCards]
        if (fullReload.length > 0) {
          setQueue(fullReload)
          setCurrentIndex(0)
          setRevealed(false)
          setWaitingUntil(null)
          return
        }

        const nextDue = await getNextDueInReviewDay(freshDeck, new Date())
        if (nextDue) {
          setQueue([])
          setWaitingUntil(nextDue)
          setRevealed(false)
          return
        }
      }
      // Queue truly empty — session done
      setQueue([])
      setWaitingUntil(null)
      onComplete()
    }
  }

  if (loading) {
    return <p className="text-gray-500 py-8 text-center">Loading review queue...</p>
  }

  if (queue.length === 0 && waitingUntil) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 text-lg">
          Next card due in {formatInterval(new Date(), waitingUntil)}.
        </p>
        <p className="text-gray-400 text-sm mt-2">
          This review session will continue automatically.
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
  const progress = (reviewed + remaining) > 0 ? (reviewed / (reviewed + remaining)) * 100 : 0
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
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-fade-in ${toast.error ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.message}
        </div>
      )}

      {/* Edit card modal */}
      {editingCard && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md">
            <h3 className="font-semibold text-lg mb-3">Edit Card</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Front</label>
                <input
                  type="text"
                  value={editFront}
                  onChange={(e) => setEditFront(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Back</label>
                <input
                  type="text"
                  value={editBack}
                  onChange={(e) => setEditBack(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 bg-blue-500 text-white py-2 rounded font-medium"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingCard(null)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
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

            {currentCard.examples && currentCard.examples.length > 0 && (
              <div className="mt-2 mb-2 text-left">
                <p className="text-xs font-medium text-gray-500 mb-1">Examples ({currentCard.examples.length})</p>
                <div className="space-y-1">
                  {currentCard.examples.map((ex) => (
                    <div key={ex.id} className="text-sm">
                      <span className={`inline-block text-xs px-1.5 py-0.5 rounded-full mr-1 ${
                        ex.direction === 'source-to-target'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-purple-50 text-purple-600'
                      }`}>
                        {ex.direction === 'source-to-target' ? 'S→T' : 'T→S'}
                      </span>
                      <span className="text-gray-800">{ex.sourceText}</span>
                      <span className="text-gray-400 mx-1">→</span>
                      <span className="text-gray-500">{ex.targetText}</span>
                    </div>
                  ))}
                </div>
              </div>
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

            <div className="flex justify-center gap-4 mt-2 mb-2">
              <button
                onClick={() => handleEditCard(currentCard)}
                className="text-sm text-blue-500 hover:text-blue-700"
              >
                Edit
              </button>
              <button
                onClick={handleDeleteCard}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </div>

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
