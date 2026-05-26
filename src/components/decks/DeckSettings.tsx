import { useState } from 'react'
import { updateDeck, skipForwardOneDay, repairDeckSchema } from '../../services/deck'
import { getDayBoundary, getReviewDayKey } from '../../services/review'
import EditableNumberInput from '../common/EditableNumberInput'
import type { Card, Deck } from '../../types'

interface Props {
  deck: Deck
  cards: Card[]
  onUpdate: () => void
}

export default function DeckSettings({ deck, cards, onUpdate }: Props) {
  const [schemaMessage, setSchemaMessage] = useState('')
  const newCardsPerDay = deck.newCardsPerDay
  const autoAddConjugations = deck.autoAddConjugations ?? true
  const maxConjugationCardsPerDay = deck.maxConjugationCardsPerDay ?? 5
  const conjugationCardsStartLearning = deck.conjugationCardsStartLearning ?? false
  const dayStartHour = deck.dayStartHour ?? 9
  const requestRetention = deck.requestRetention ?? 0.9

  const handleSave = async (updates: Partial<Deck>) => {
    await updateDeck(deck.id, updates)
    onUpdate()
  }

  const handleRepairSchema = async () => {
    const result = await repairDeckSchema(deck.id)
    if (result.changed) {
      setSchemaMessage(`Updated deck schema: ${result.changes.join(', ')}`)
    } else {
      setSchemaMessage('Deck schema is already up to date.')
    }
    onUpdate()
  }

  const today = getReviewDayKey(new Date(), deck.dayStartHour ?? 9)
  const newCardsToday = deck.lastNewCardDate === today ? (deck.newCardsIntroducedToday ?? 0) : 0
  const conjCardsToday = deck.lastConjugationCardDate === today ? (deck.conjugationCardsAddedToday ?? 0) : 0
  const dayBoundary = getDayBoundary(new Date(), dayStartHour)
  const totalCards = cards.length
  const newCards = cards.filter((card) => card.fsrs.state === 'new').length
  const learningCards = cards.filter((card) =>
    card.fsrs.state === 'learning' || card.fsrs.state === 'relearning'
  ).length
  const reviewCards = cards.filter((card) => card.fsrs.state === 'review').length
  const dueToday = cards.filter((card) =>
    card.fsrs.state !== 'new' && new Date(card.fsrs.dueDate) <= dayBoundary
  ).length
  const deckStats = [
    { label: 'Total cards', value: totalCards },
    { label: 'New', value: newCards },
    { label: 'Learning', value: learningCards },
    { label: 'Review', value: reviewCards },
    { label: 'Due today', value: dueToday },
  ]

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow border p-4">
        <h3 className="font-semibold text-lg mb-3">Deck Stats</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {deckStats.map((stat) => (
            <div
              key={stat.label}
              aria-label={`${stat.label}: ${stat.value}`}
              className="rounded-lg bg-gray-50 border px-3 py-2"
            >
              <div className="text-2xl font-semibold text-gray-900">{stat.value}</div>
              <div className="text-xs font-medium text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Due today includes learning, relearning, and review cards due before the deck's review-day boundary.
        </p>
      </div>

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
                  handleSave({ newCardsPerDay: val })
                }}
                className="flex-1"
              />
              <EditableNumberInput
                min={0}
                max={100}
                value={newCardsPerDay}
                onCommit={(value) => {
                  handleSave({ newCardsPerDay: value })
                }}
                className="w-16 border rounded px-2 py-1 text-sm text-center"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Number of new cards made reviewable at once each review day (currently {newCardsToday} today)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target retention: {Math.round(requestRetention * 100)}%
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={80}
                max={97}
                value={Math.round(requestRetention * 100)}
                onChange={(e) => {
                  const val = parseInt(e.target.value) / 100
                  handleSave({ requestRetention: val })
                }}
                className="flex-1"
              />
              <span className="w-16 text-sm text-center">{Math.round(requestRetention * 100)}%</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Higher retention = shorter intervals and more reviews. Lower = longer intervals, fewer reviews. Default is 90%.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border p-4">
        <h3 className="font-semibold text-lg mb-2">Schema Maintenance</h3>
        <p className="text-xs text-gray-400 mb-3">
          Updates older decks with missing defaults, then resets and recomputes the active new-card queue for the current review day.
        </p>
        <button
          onClick={handleRepairSchema}
          className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
        >
          Update Deck Schema
        </button>
        {schemaMessage && (
          <p className="text-sm text-gray-600 mt-2">{schemaMessage}</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow border p-4">
        <h3 className="font-semibold text-lg mb-4">Auto-Add Conjugation Cards</h3>

        <div className="space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoAddConjugations}
              onChange={(e) => {
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
            <>
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
                      handleSave({ maxConjugationCardsPerDay: val })
                    }}
                    className="flex-1"
                  />
                  <EditableNumberInput
                    min={1}
                    max={20}
                    value={maxConjugationCardsPerDay}
                    onCommit={(value) => {
                      handleSave({ maxConjugationCardsPerDay: value })
                    }}
                    className="w-16 border rounded px-2 py-1 text-sm text-center"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Daily limit for auto-added conjugation cards across all verbs (currently {conjCardsToday} today)
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={conjugationCardsStartLearning}
                  onChange={(e) => {
                    handleSave({ conjugationCardsStartLearning: e.target.checked })
                  }}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  Start conjugation cards as immediately reviewable
                </span>
              </label>
              <p className="text-xs text-gray-400">
                {conjugationCardsStartLearning
                  ? 'Auto-added conjugation cards will appear in the review queue immediately.'
                  : 'Auto-added conjugation cards will be added as new cards and introduced with the next daily new-card set.'}
              </p>
            </>
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

      <div className="bg-white rounded-lg shadow border p-4">
        <h3 className="font-semibold text-lg mb-2">Time Controls</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Day starts at
            </label>
            <div className="flex items-center gap-2">
              <EditableNumberInput
                min={0}
                max={23}
                value={dayStartHour}
                onCommit={(value) => {
                  handleSave({ dayStartHour: value })
                }}
                className="w-16 border rounded px-2 py-1 text-sm text-center"
              />
              <span className="text-sm text-gray-500">:00</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Review sessions include all cards due before this hour tomorrow, including learning and relearning cards.
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-2">
              Shift all card schedules forward by one day. Makes tomorrow's due cards available for review today and resets daily counters.
            </p>
            <button
              onClick={async () => {
                if (!confirm('Skip forward one day? This will shift all card due dates back by 24 hours and reset daily counters.')) return
                await skipForwardOneDay(deck.id)
                onUpdate()
              }}
              className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600"
            >
              Skip Forward One Day
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
