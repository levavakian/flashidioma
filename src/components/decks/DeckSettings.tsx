import { useState, useEffect } from 'react'
import { updateDeck } from '../../services/deck'
import type { Deck } from '../../types'

interface Props {
  deck: Deck
  onUpdate: () => void
}

export default function DeckSettings({ deck, onUpdate }: Props) {
  const [newCardsPerDay, setNewCardsPerDay] = useState(deck.newCardsPerDay)
  const [newCardBatchSize, setNewCardBatchSize] = useState(deck.newCardBatchSize)
  const [autoAddConjugations, setAutoAddConjugations] = useState(deck.autoAddConjugations ?? true)
  const [maxConjugationCardsPerDay, setMaxConjugationCardsPerDay] = useState(deck.maxConjugationCardsPerDay ?? 5)

  useEffect(() => {
    setNewCardsPerDay(deck.newCardsPerDay)
    setNewCardBatchSize(deck.newCardBatchSize)
    setAutoAddConjugations(deck.autoAddConjugations ?? true)
    setMaxConjugationCardsPerDay(deck.maxConjugationCardsPerDay ?? 5)
  }, [deck])

  const handleSave = async (updates: Partial<Deck>) => {
    await updateDeck(deck.id, updates)
    onUpdate()
  }

  const today = new Date().toISOString().split('T')[0]
  const newCardsToday = deck.lastNewCardDate === today ? (deck.newCardsIntroducedToday ?? 0) : 0
  const conjCardsToday = deck.lastConjugationCardDate === today ? (deck.conjugationCardsAddedToday ?? 0) : 0

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow border p-4">
        <h3 className="font-semibold text-lg mb-4">Spaced Repetition Settings</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New cards per day
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={newCardsPerDay}
                onChange={(e) => {
                  const val = parseInt(e.target.value)
                  setNewCardsPerDay(val)
                  handleSave({ newCardsPerDay: val })
                }}
                className="flex-1"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={newCardsPerDay}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                  setNewCardsPerDay(val)
                  handleSave({ newCardsPerDay: val })
                }}
                className="w-16 border rounded px-2 py-1 text-sm text-center"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Maximum number of new cards introduced per day (currently {newCardsToday} today)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New card batch size
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={50}
                value={newCardBatchSize}
                onChange={(e) => {
                  const val = parseInt(e.target.value)
                  setNewCardBatchSize(val)
                  handleSave({ newCardBatchSize: val })
                }}
                className="flex-1"
              />
              <input
                type="number"
                min={1}
                max={50}
                value={newCardBatchSize}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(50, parseInt(e.target.value) || 1))
                  setNewCardBatchSize(val)
                  handleSave({ newCardBatchSize: val })
                }}
                className="w-16 border rounded px-2 py-1 text-sm text-center"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              How many new cards to introduce at a time before requiring review
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border p-4">
        <h3 className="font-semibold text-lg mb-4">Auto-Add Conjugation Cards</h3>

        <div className="space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoAddConjugations}
              onChange={(e) => {
                setAutoAddConjugations(e.target.checked)
                handleSave({ autoAddConjugations: e.target.checked })
              }}
              className="rounded"
            />
            <span className="text-sm font-medium text-gray-700">
              Auto-add conjugation cards on Good/Easy review
            </span>
          </label>
          <p className="text-xs text-gray-400">
            When you review a verb and grade Good or Easy, a random conjugation form
            (from enabled constructs) will be added as a new card pair.
          </p>

          {autoAddConjugations && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max conjugation cards per day
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={maxConjugationCardsPerDay}
                  onChange={(e) => {
                    const val = parseInt(e.target.value)
                    setMaxConjugationCardsPerDay(val)
                    handleSave({ maxConjugationCardsPerDay: val })
                  }}
                  className="flex-1"
                />
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={maxConjugationCardsPerDay}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(20, parseInt(e.target.value) || 1))
                    setMaxConjugationCardsPerDay(val)
                    handleSave({ maxConjugationCardsPerDay: val })
                  }}
                  className="w-16 border rounded px-2 py-1 text-sm text-center"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Daily limit for auto-added conjugation cards across all verbs (currently {conjCardsToday} today)
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg border p-4">
        <h4 className="text-sm font-medium text-gray-600 mb-2">Today's Stats</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">New cards introduced:</span>
            <span className="ml-1 font-medium">{newCardsToday} / {newCardsPerDay}</span>
          </div>
          <div>
            <span className="text-gray-500">Conjugation cards added:</span>
            <span className="ml-1 font-medium">{conjCardsToday} / {autoAddConjugations ? maxConjugationCardsPerDay : 'off'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
