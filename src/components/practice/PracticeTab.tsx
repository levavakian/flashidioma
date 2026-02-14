import { useEffect, useState, useCallback } from 'react'
import { generatePracticeSentences } from '../../services/llm'
import type { BatchSentenceRequest } from '../../services/llm'
import { createCard, getCardsByDeck, addExampleToCardAndCompanions } from '../../services/card'
import { db } from '../../db'
import { spanishLanguageModule } from '../../languages/spanish'
import type { Deck, PracticeSentence, Card, CardExample } from '../../types'

interface Props {
  deck: Deck
}

export default function PracticeTab({ deck }: Props) {
  const [sentences, setSentences] = useState<PracticeSentence[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [addedMessage, setAddedMessage] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)

  // Settings
  const [stCount, setStCount] = useState(3)
  const [tsCount, setTsCount] = useState(2)
  const [maxDeckCards, setMaxDeckCards] = useState(3)

  // Swipe tracking
  const [touchStartX, setTouchStartX] = useState<number | null>(null)

  useEffect(() => {
    db.practiceSentences
      .where('deckId')
      .equals(deck.id)
      .toArray()
      .then(setSentences)
  }, [deck.id])

  const handleGenerate = async () => {
    setError('')
    setGenerating(true)
    setAddedMessage('')

    try {
      const cards = await getCardsByDeck(deck.id)
      const reviewedCards = cards.filter((c) => c.fsrs.state !== 'new')

      if (reviewedCards.length === 0) {
        setError('No reviewed cards available. Review some cards first.')
        setGenerating(false)
        return
      }

      const enabledConstructs = spanishLanguageModule.constructs
        .filter((c) => deck.constructChecklist[c.id])
        .map((c) => c.name)

      // Build batch requests
      const requests: BatchSentenceRequest[] = []
      const cardIdsPerRequest: string[][] = []

      const pickRandomCards = (count: number): Card[] => {
        const n = Math.floor(Math.random() * count) + 1 // randint(1, count)
        const shuffled = [...reviewedCards].sort(() => Math.random() - 0.5)
        return shuffled.slice(0, Math.min(n, shuffled.length))
      }

      // S→T sentences
      for (let i = 0; i < stCount; i++) {
        const picked = pickRandomCards(maxDeckCards)
        requests.push({
          cards: picked.map((c) => ({
            source: c.direction === 'source-to-target' ? c.frontText : c.backText,
            target: c.direction === 'source-to-target' ? c.backText : c.frontText,
          })),
          direction: 'source-to-target',
        })
        cardIdsPerRequest.push(picked.map((c) => c.id))
      }

      // T→S sentences
      for (let i = 0; i < tsCount; i++) {
        const picked = pickRandomCards(maxDeckCards)
        requests.push({
          cards: picked.map((c) => ({
            source: c.direction === 'source-to-target' ? c.frontText : c.backText,
            target: c.direction === 'source-to-target' ? c.backText : c.frontText,
          })),
          direction: 'target-to-source',
        })
        cardIdsPerRequest.push(picked.map((c) => c.id))
      }

      if (requests.length === 0) {
        setError('Set at least one S→T or T→S sentence count.')
        setGenerating(false)
        return
      }

      const results = await generatePracticeSentences(requests, enabledConstructs)

      const newSentences: PracticeSentence[] = results.map((result, idx) => ({
        id: crypto.randomUUID(),
        deckId: deck.id,
        sourceText: result.sourceText,
        targetText: result.targetText,
        selectedVerb: null,
        selectedAdjective: null,
        selectedConstruct: null,
        sourceCardIds: cardIdsPerRequest[idx],
        direction: requests[idx].direction,
        createdAt: new Date().toISOString(),
      }))

      // Save sentences to DB
      await db.practiceSentences.bulkPut(newSentences)

      // Save examples to source cards
      for (const sentence of newSentences) {
        const example: CardExample = {
          id: crypto.randomUUID(),
          sourceText: sentence.sourceText,
          targetText: sentence.targetText,
          direction: sentence.direction,
          createdAt: sentence.createdAt,
        }
        for (const cardId of sentence.sourceCardIds) {
          await addExampleToCardAndCompanions(deck.id, cardId, example)
        }
      }

      setSentences((prev) => [...prev, ...newSentences])
      setCurrentIndex(prev => prev === 0 ? 0 : sentences.length) // go to first new one if we already had some
      setRevealed(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleClearAndRegenerate = async () => {
    await db.practiceSentences.where('deckId').equals(deck.id).delete()
    setSentences([])
    setCurrentIndex(0)
    setRevealed(false)
    await handleGenerate()
  }

  const handleConvertToCard = async (sentence: PracticeSentence) => {
    setAddedMessage('')
    await createCard({
      deckId: deck.id,
      frontText: sentence.sourceText,
      backText: sentence.targetText,
      direction: 'source-to-target',
      source: 'practice',
    })
    setAddedMessage(`Added card: "${sentence.sourceText}"`)
    setTimeout(() => setAddedMessage(''), 3000)
  }

  // Navigation
  const goNext = useCallback(() => {
    if (sentences.length === 0) return
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex((i) => i + 1)
      setRevealed(false)
    }
  }, [sentences.length, currentIndex])

  const goPrev = useCallback(() => {
    if (sentences.length === 0) return
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1)
      setRevealed(false)
    }
  }, [sentences.length, currentIndex])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (sentences.length === 0) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      } else if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        setRevealed(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sentences.length, revealed, goNext, goPrev])

  // Touch/swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return
    const deltaX = e.changedTouches[0].clientX - touchStartX
    if (Math.abs(deltaX) > 50) {
      if (deltaX > 0) goPrev()
      else goNext()
    }
    setTouchStartX(null)
  }

  const currentSentence = sentences[currentIndex]
  const directionLabel = currentSentence?.direction === 'source-to-target' ? 'S→T' : 'T→S'
  // For S→T: show English (sourceText), reveal Spanish (targetText)
  // For T→S: show Spanish (targetText), reveal English (sourceText)
  const displayFront = currentSentence
    ? currentSentence.direction === 'source-to-target'
      ? currentSentence.sourceText
      : currentSentence.targetText
    : ''
  const displayBack = currentSentence
    ? currentSentence.direction === 'source-to-target'
      ? currentSentence.targetText
      : currentSentence.sourceText
    : ''

  return (
    <div>
      {/* Settings bar */}
      <div className="bg-gray-50 rounded-lg border p-3 mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">S→T:</label>
            <input
              type="number"
              min={0}
              max={20}
              value={stCount}
              onChange={(e) => setStCount(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-14 border rounded px-2 py-1 text-sm text-center"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">T→S:</label>
            <input
              type="number"
              min={0}
              max={20}
              value={tsCount}
              onChange={(e) => setTsCount(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-14 border rounded px-2 py-1 text-sm text-center"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">Max cards:</label>
            <input
              type="number"
              min={1}
              max={10}
              value={maxDeckCards}
              onChange={(e) => setMaxDeckCards(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-14 border rounded px-2 py-1 text-sm text-center"
            />
          </div>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-blue-500 text-white px-4 py-1 rounded text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate'}
            </button>
            {sentences.length > 0 && (
              <button
                onClick={handleClearAndRegenerate}
                disabled={generating}
                className="bg-gray-100 text-gray-700 px-4 py-1 rounded text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
              >
                Clear & Regenerate
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-3 py-2 rounded mb-3 text-sm">{error}</div>
      )}

      {addedMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {addedMessage}
        </div>
      )}

      {sentences.length === 0 && !generating && (
        <p className="text-gray-500 text-sm">
          No practice sentences yet. Configure counts above and click Generate.
        </p>
      )}

      {generating && sentences.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500 text-lg">Generating practice sentences...</p>
        </div>
      )}

      {/* Card-style review UI */}
      {currentSentence && (
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Navigation header */}
          <div className="flex justify-between items-center text-sm text-gray-500 mb-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              currentSentence.direction === 'source-to-target'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-purple-100 text-purple-700'
            }`}>
              {directionLabel}
            </span>
            <span>{currentIndex + 1} / {sentences.length}</span>
          </div>

          {/* Card */}
          <div className="bg-white rounded-lg shadow border p-6 text-center min-h-[200px] flex flex-col justify-center">
            <p className="text-2xl font-medium mb-4">{displayFront}</p>

            {revealed ? (
              <>
                <hr className="my-4" />
                <p className="text-xl text-gray-700 mb-4">{displayBack}</p>

                <button
                  onClick={() => handleConvertToCard(currentSentence)}
                  className="mx-auto text-xs bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                >
                  Add as Card
                </button>
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

          {/* Navigation arrows */}
          <div className="flex justify-between items-center mt-3">
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="px-4 py-2 rounded text-sm border disabled:opacity-30 hover:bg-gray-50"
            >
              ← Prev
            </button>
            <button
              onClick={goNext}
              disabled={currentIndex >= sentences.length - 1}
              className="px-4 py-2 rounded text-sm border disabled:opacity-30 hover:bg-gray-50"
            >
              Next →
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-1">
            Use arrow keys or swipe to navigate
          </p>
        </div>
      )}
    </div>
  )
}
