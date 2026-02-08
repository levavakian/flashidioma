import { useEffect, useState } from 'react'
import { generatePracticeSentence } from '../../services/llm'
import { createCard } from '../../services/card'
import { getCardsByDeck } from '../../services/card'
import { db } from '../../db'
import { spanishLanguageModule } from '../../languages/spanish'
import type { Deck, PracticeSentence } from '../../types'

interface Props {
  deck: Deck
}

export default function PracticeTab({ deck }: Props) {
  const [sentences, setSentences] = useState<PracticeSentence[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [addedMessage, setAddedMessage] = useState('')

  useEffect(() => {
    db.practiceSentences
      .where('deckId')
      .equals(deck.id)
      .toArray()
      .then(setSentences)
  }, [deck.id])

  const getRandomElement = <T,>(arr: T[]): T | null => {
    if (arr.length === 0) return null
    return arr[Math.floor(Math.random() * arr.length)]
  }

  const handleGenerate = async () => {
    setError('')
    setGenerating(true)
    setAddedMessage('')

    try {
      const cards = await getCardsByDeck(deck.id)
      // Only use reviewed cards for vocab selection
      const reviewedCards = cards.filter((c) => c.fsrs.state !== 'new')

      // Select a random verb (70% chance of selecting one)
      const verbs = reviewedCards.filter(
        (c) => c.tags.includes('v') || c.tags.includes('verb')
      )
      const selectedVerb =
        Math.random() < 0.7 ? getRandomElement(verbs) : null

      // Select a random adjective (50% chance)
      const adjectives = reviewedCards.filter(
        (c) => c.tags.includes('adj') || c.tags.includes('adjective')
      )
      const selectedAdj =
        Math.random() < 0.5 ? getRandomElement(adjectives) : null

      // Select a random enabled tense
      const enabledConstructs = spanishLanguageModule.constructs.filter(
        (c) => deck.constructChecklist[c.id]
      )
      const selectedConstruct = getRandomElement(enabledConstructs)

      const verbWord = selectedVerb
        ? selectedVerb.direction === 'source-to-target'
          ? selectedVerb.backText
          : selectedVerb.frontText
        : null

      const adjWord = selectedAdj
        ? selectedAdj.direction === 'source-to-target'
          ? selectedAdj.backText
          : selectedAdj.frontText
        : null

      const result = await generatePracticeSentence(
        verbWord,
        adjWord,
        selectedConstruct?.name ?? null
      )

      const sentence: PracticeSentence = {
        id: crypto.randomUUID(),
        deckId: deck.id,
        sourceText: result.sourceText,
        targetText: result.targetText,
        selectedVerb: verbWord,
        selectedAdjective: adjWord,
        selectedConstruct: selectedConstruct?.name ?? null,
        createdAt: new Date().toISOString(),
      }

      await db.practiceSentences.put(sentence)
      setSentences((prev) => [...prev, sentence])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleRegenerate = async () => {
    await db.practiceSentences.where('deckId').equals(deck.id).delete()
    setSentences([])
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
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Practice Sentences</h3>
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-blue-500 text-white px-4 py-1 rounded text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate'}
          </button>
          {sentences.length > 0 && (
            <button
              onClick={handleRegenerate}
              disabled={generating}
              className="bg-gray-100 text-gray-700 px-4 py-1 rounded text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
            >
              Clear & Regenerate
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-3 py-2 rounded mb-3 text-sm">{error}</div>
      )}

      {addedMessage && (
        <div className="bg-green-50 text-green-600 px-3 py-2 rounded mb-3 text-sm">{addedMessage}</div>
      )}

      {sentences.length === 0 && !generating && (
        <p className="text-gray-500 text-sm">
          No practice sentences yet. Click Generate to create one using your reviewed vocabulary.
        </p>
      )}

      <div className="space-y-3">
        {sentences.map((sentence) => (
          <div key={sentence.id} className="bg-white rounded-lg border p-4">
            <p className="font-medium text-lg">{sentence.sourceText}</p>
            <p className="text-gray-600 mt-1">{sentence.targetText}</p>
            <div className="flex items-center gap-3 mt-2">
              {sentence.selectedVerb && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                  {sentence.selectedVerb}
                </span>
              )}
              {sentence.selectedAdjective && (
                <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                  {sentence.selectedAdjective}
                </span>
              )}
              {sentence.selectedConstruct && (
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  {sentence.selectedConstruct}
                </span>
              )}
              <button
                onClick={() => handleConvertToCard(sentence)}
                className="ml-auto text-xs bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
              >
                Add as Card
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
