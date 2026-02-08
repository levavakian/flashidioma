import { useEffect, useState, useCallback, useRef } from 'react'
import { reviewCard, getReviewQueue } from '../../services/review'
import type { Deck, Card } from '../../types'

interface Props {
  deck: Deck
  onComplete: () => void
}

export default function ReviewSession({ deck, onComplete }: Props) {
  const [queue, setQueue] = useState<Card[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [totalDue, setTotalDue] = useState(0)
  const [totalNew, setTotalNew] = useState(0)
  const [reviewed, setReviewed] = useState(0)

  const gradingRef = useRef(false)

  // Keyboard shortcuts: space to reveal, 1-4 to grade
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (gradingRef.current) return
      if (!currentCard) return

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

  const currentCard = queue[currentIndex]

  const handleGrade = async (grade: number) => {
    if (!currentCard) return

    await reviewCard(currentCard.id, grade)
    setReviewed((r) => r + 1)

    if (currentIndex + 1 < queue.length) {
      setCurrentIndex((i) => i + 1)
      setRevealed(false)
    } else {
      // Session complete
      onComplete()
      await loadQueue()
    }
  }

  if (loading) {
    return <p className="text-gray-500">Loading review queue...</p>
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
      <div className="flex justify-between text-sm text-gray-500 mb-4">
        <span>
          {reviewed} reviewed
        </span>
        <span>
          {remaining} remaining ({totalDue} due, {totalNew} new)
        </span>
      </div>

      <div className="bg-white rounded-lg shadow border p-6 text-center min-h-[200px] flex flex-col justify-center">
        <p className="text-2xl font-medium mb-4">{displayFront}</p>

        {revealed ? (
          <>
            <hr className="my-4" />
            <p className="text-xl text-gray-700 mb-6">{displayBack}</p>

            {currentCard.notes && (
              <p className="text-sm text-gray-400 mb-4 italic">{currentCard.notes}</p>
            )}

            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => handleGrade(1)}
                className="bg-red-500 text-white py-3 rounded-lg font-medium text-sm hover:bg-red-600"
              >
                Again
              </button>
              <button
                onClick={() => handleGrade(2)}
                className="bg-orange-500 text-white py-3 rounded-lg font-medium text-sm hover:bg-orange-600"
              >
                Hard
              </button>
              <button
                onClick={() => handleGrade(3)}
                className="bg-green-500 text-white py-3 rounded-lg font-medium text-sm hover:bg-green-600"
              >
                Good
              </button>
              <button
                onClick={() => handleGrade(4)}
                className="bg-blue-500 text-white py-3 rounded-lg font-medium text-sm hover:bg-blue-600"
              >
                Easy
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => setRevealed(true)}
            className="mt-4 bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-200"
          >
            Show Answer
          </button>
        )}
      </div>
    </div>
  )
}
