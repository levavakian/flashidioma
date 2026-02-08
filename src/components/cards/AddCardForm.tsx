import { useState } from 'react'
import { createCard, createCardBothDirections } from '../../services/card'
import { checkDuplicate } from '../../services/deduplication'
import type { Card, CardDirection } from '../../types'

interface Props {
  deckId: string
  onAdded: () => void
  initialFront?: string
  initialBack?: string
}

export default function AddCardForm({ deckId, onAdded, initialFront, initialBack }: Props) {
  const [frontText, setFrontText] = useState(initialFront ?? '')
  const [backText, setBackText] = useState(initialBack ?? '')
  const [direction, setDirection] = useState<CardDirection | 'both'>('source-to-target')
  const [tags, setTags] = useState('')
  const [error, setError] = useState('')
  const [duplicates, setDuplicates] = useState<Card[]>([])
  const [dupDismissed, setDupDismissed] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const front = frontText.trim()
    const back = backText.trim()

    if (!front || !back) {
      setError('Both front and back text are required.')
      return
    }

    // Check for duplicates (target language text)
    // For source-to-target, the target text is backText
    // For target-to-source, the target text is frontText
    // For both, check backText (which is the target in the source-to-target card)
    if (!dupDismissed) {
      const targetText = direction === 'target-to-source' ? front : back
      const dups = await checkDuplicate(deckId, targetText)
      if (dups.length > 0) {
        setDuplicates(dups)
        return
      }
    }

    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    if (direction === 'both') {
      await createCardBothDirections({
        deckId,
        frontText: front,
        backText: back,
        tags: tagList,
      })
    } else {
      await createCard({
        deckId,
        frontText: front,
        backText: back,
        direction,
        tags: tagList,
      })
    }

    setFrontText('')
    setBackText('')
    setTags('')
    setDuplicates([])
    setDupDismissed(false)
    onAdded()
  }

  const handleDismissDuplicate = async () => {
    setDupDismissed(true)
    setDuplicates([])
    // Re-submit the form by triggering handleSubmit logic
    const front = frontText.trim()
    const back = backText.trim()
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)

    if (direction === 'both') {
      await createCardBothDirections({
        deckId,
        frontText: front,
        backText: back,
        tags: tagList,
      })
    } else {
      await createCard({
        deckId,
        frontText: front,
        backText: back,
        direction,
        tags: tagList,
      })
    }

    setFrontText('')
    setBackText('')
    setTags('')
    setDuplicates([])
    setDupDismissed(false)
    onAdded()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow border p-4">
      <h3 className="font-semibold text-lg mb-3">Add New Card</h3>

      {error && (
        <div className="bg-red-50 text-red-600 px-3 py-2 rounded mb-3 text-sm">
          {error}
        </div>
      )}

      {duplicates.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 px-3 py-2 rounded mb-3 text-sm">
          <p className="font-medium text-yellow-800">Duplicate detected!</p>
          <p className="text-yellow-700 mt-1">
            Similar card(s) already exist:
          </p>
          <ul className="mt-1 text-yellow-700">
            {duplicates.map((d) => (
              <li key={d.id}>
                "{d.frontText}" &rarr; "{d.backText}"
              </li>
            ))}
          </ul>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleDismissDuplicate}
              className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600"
            >
              Add Anyway
            </button>
            <button
              type="button"
              onClick={() => setDuplicates([])}
              className="text-yellow-700 px-3 py-1 rounded text-sm hover:bg-yellow-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Front (source language)
          </label>
          <input
            type="text"
            value={frontText}
            onChange={(e) => setFrontText(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="e.g. hello"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Back (target language)
          </label>
          <input
            type="text"
            value={backText}
            onChange={(e) => setBackText(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="e.g. hola"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Direction
          </label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as CardDirection | 'both')}
            className="w-full border rounded px-3 py-2"
          >
            <option value="source-to-target">Source &rarr; Target</option>
            <option value="target-to-source">Target &rarr; Source</option>
            <option value="both">Both directions (creates 2 cards)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="e.g. verb, common"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 rounded-lg font-medium hover:bg-blue-600"
        >
          Add Card
        </button>
      </div>
    </form>
  )
}
