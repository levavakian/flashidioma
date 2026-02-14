import { useState, useMemo, useEffect, useCallback } from 'react'
import { updateCard, deleteCard, removeExampleFromCardAndCompanions } from '../../services/card'
import { hydrateConjugation } from '../../services/llm'
import { lookupConjugation } from '../../services/conjugationLookup'
import ConjugationView from './ConjugationView'
import type { Card, VerbData, ConstructChecklist } from '../../types'

const PAGE_SIZE = 50

interface Props {
  cards: Card[]
  deckId: string
  onUpdate: () => void
  enabledConstructs?: ConstructChecklist
}

export default function CardList({ cards, onUpdate, enabledConstructs }: Props) {
  const [search, setSearch] = useState('')
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [hydratingId, setHydratingId] = useState<string | null>(null)
  const [hydrateErrors, setHydrateErrors] = useState<Map<string, string>>(new Map())
  const [page, setPage] = useState(0)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const [lookedUpConjugations, setLookedUpConjugations] = useState<Map<string, VerbData | null>>(new Map())

  const filtered = useMemo(() => {
    let result = cards
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.frontText.toLowerCase().includes(q) ||
          c.backText.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    // Sort by sortOrder (frequency rank) if present, then createdAt
    return [...result].sort((a, b) => {
      if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
        return a.sortOrder - b.sortOrder
      }
      if (a.sortOrder !== undefined) return -1
      if (b.sortOrder !== undefined) return 1
      return a.createdAt.localeCompare(b.createdAt)
    })
  }, [cards, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  /**
   * Find verbData for a card, checking:
   * 1. The card's own verbData
   * 2. The paired card's verbData (same word pair, opposite direction)
   * 3. Static DB lookup cache
   */
  const getConjugationData = useCallback((card: Card): VerbData | null => {
    if (card.verbData) return card.verbData

    // Check paired card (same front/back text, opposite direction)
    const paired = cards.find(c =>
      c.id !== card.id &&
      c.frontText === card.frontText &&
      c.backText === card.backText &&
      c.direction !== card.direction
    )
    if (paired?.verbData) return paired.verbData

    return lookedUpConjugations.get(card.id) ?? null
  }, [cards, lookedUpConjugations])

  // Auto-load conjugation from static DB when a card is expanded
  const autoLoadConjugation = useCallback(async (card: Card) => {
    // Skip if we already have data from any source
    if (getConjugationData(card)) return
    if (lookedUpConjugations.has(card.id)) return // Already looked up (even if null)

    const verb = card.direction === 'source-to-target' ? card.backText : card.frontText
    const result = await lookupConjugation(verb)
    setLookedUpConjugations(prev => {
      const next = new Map(prev)
      next.set(card.id, result)
      return next
    })
  }, [getConjugationData, lookedUpConjugations])

  useEffect(() => {
    if (!expandedCardId) return
    const card = cards.find(c => c.id === expandedCardId)
    if (card) autoLoadConjugation(card)
  }, [expandedCardId, cards, autoLoadConjugation])

  // Reset page when search changes
  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(0)
  }

  const handleEdit = (card: Card) => {
    setEditingCard(card)
    setEditFront(card.frontText)
    setEditBack(card.backText)
    setEditNotes(card.notes)
  }

  const handleSaveEdit = async () => {
    if (!editingCard) return
    await updateCard(editingCard.id, {
      frontText: editFront.trim(),
      backText: editBack.trim(),
      notes: editNotes.trim(),
    })
    setEditingCard(null)
    onUpdate()
  }

  const handleDelete = async (card: Card) => {
    if (!confirm(`Delete card "${card.frontText}"?`)) return
    await deleteCard(card.id)
    setExpandedCardId(null)
    onUpdate()
  }

  const setCardError = (cardId: string, error: string) => {
    setHydrateErrors(prev => {
      const next = new Map(prev)
      next.set(cardId, error)
      return next
    })
  }

  const clearCardError = (cardId: string) => {
    setHydrateErrors(prev => {
      const next = new Map(prev)
      next.delete(cardId)
      return next
    })
  }

  const handleHydrate = async (card: Card) => {
    clearCardError(card.id)
    setHydratingId(card.id)
    try {
      // Use the Spanish word (target language) for conjugation
      const verb = card.direction === 'source-to-target' ? card.backText : card.frontText
      const verbData = await hydrateConjugation(verb)
      if (verbData === null) {
        setCardError(card.id, `"${verb}" is not a verb.`)
        return
      }
      await updateCard(card.id, { verbData })
      // Also update the paired card if it exists
      const paired = cards.find(c =>
        c.id !== card.id &&
        c.frontText === card.frontText &&
        c.backText === card.backText &&
        c.direction !== card.direction
      )
      if (paired) {
        await updateCard(paired.id, { verbData })
      }
      onUpdate()
    } catch (e) {
      setCardError(card.id, e instanceof Error ? e.message : 'Hydration failed')
    } finally {
      setHydratingId(null)
    }
  }

  const toggleExpand = (cardId: string) => {
    setExpandedCardId(prev => prev === cardId ? null : cardId)
  }

  const stateLabel = (state: Card['fsrs']['state']) => {
    switch (state) {
      case 'new': return 'New'
      case 'learning': return 'Learning'
      case 'review': return 'Review'
      case 'relearning': return 'Relearning'
    }
  }

  const stateColor = (state: Card['fsrs']['state']) => {
    switch (state) {
      case 'new': return 'bg-blue-100 text-blue-700'
      case 'learning': return 'bg-yellow-100 text-yellow-700'
      case 'review': return 'bg-green-100 text-green-700'
      case 'relearning': return 'bg-orange-100 text-orange-700'
    }
  }

  const formatDueDate = (card: Card): string | null => {
    if (card.fsrs.state === 'new') return null
    const now = Date.now()
    const due = new Date(card.fsrs.dueDate).getTime()
    const diffMs = due - now
    if (diffMs <= 0) {
      const overMs = -diffMs
      const overMin = Math.round(overMs / 60000)
      if (overMin < 60) return 'Due now'
      const overH = Math.round(overMin / 60)
      if (overH < 24) return `Overdue ${overH}h`
      const overD = Math.round(overH / 24)
      return `Overdue ${overD}d`
    }
    const min = Math.round(diffMs / 60000)
    if (min < 60) return `Due in ${min}m`
    const hours = Math.round(min / 60)
    if (hours < 24) return `Due in ${hours}h`
    const days = Math.round(hours / 24)
    if (days < 30) return `Due in ${days}d`
    const months = Math.round(days / 30)
    return `Due in ${months}mo`
  }

  const dueColor = (card: Card): string => {
    if (card.fsrs.state === 'new') return ''
    const due = new Date(card.fsrs.dueDate).getTime()
    if (due <= Date.now()) return 'text-orange-500 font-medium'
    return 'text-gray-400'
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search cards..."
          className="flex-1 border rounded px-3 py-2"
        />
        <span className="text-sm text-gray-400 self-center whitespace-nowrap">
          {filtered.length} card{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {filtered.length === 0 && (
        <p className="text-gray-500 text-sm">
          {cards.length === 0 ? 'No cards in this deck.' : 'No cards match your search.'}
        </p>
      )}

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

      <div className="space-y-2">
        {pageItems.map((card) => {
          const isExpanded = expandedCardId === card.id
          const conjData = isExpanded ? getConjugationData(card) : null
          const hasVerbData = card.verbData != null
          const cardError = hydrateErrors.get(card.id)

          return (
            <div key={card.id} className="bg-white rounded-lg border">
              <button
                onClick={() => toggleExpand(card.id)}
                className="w-full text-left p-3 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{card.frontText}</span>
                    <span className="text-gray-400 shrink-0">&rarr;</span>
                    <span className="text-gray-600 truncate">{card.backText}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${stateColor(card.fsrs.state)}`}
                    >
                      {stateLabel(card.fsrs.state)}
                    </span>
                    {formatDueDate(card) && (
                      <span className={`text-xs ${dueColor(card)}`}>
                        {formatDueDate(card)}
                      </span>
                    )}
                    {card.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                    <span className="text-xs text-gray-400">
                      {card.direction === 'source-to-target' ? 'S\u2192T' : 'T\u2192S'}
                    </span>
                  </div>
                </div>
                <span className="text-gray-400 ml-2 shrink-0 text-sm">
                  {isExpanded ? '\u25BC' : '\u25B6'}
                </span>
              </button>

              {isExpanded && (
                <div className="border-t px-3 pb-3">
                  {/* Per-card error */}
                  {cardError && (
                    <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm mt-2">{cardError}</div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 py-2">
                    <button
                      onClick={() => handleEdit(card)}
                      className="text-sm text-blue-500 hover:text-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleHydrate(card)}
                      disabled={hydratingId === card.id}
                      className="text-sm text-purple-500 hover:text-purple-700 disabled:opacity-50"
                    >
                      {hydratingId === card.id ? 'Hydrating...' : hasVerbData ? 'Rehydrate (LLM)' : 'Hydrate (LLM)'}
                    </button>
                    <button
                      onClick={() => handleDelete(card)}
                      className="text-sm text-red-500 hover:text-red-700 ml-auto"
                    >
                      Delete
                    </button>
                  </div>

                  {/* Conjugation view */}
                  {conjData && (
                    <ConjugationView verbData={conjData} enabledConstructs={enabledConstructs} />
                  )}
                  {!conjData && !getConjugationData(card) && lookedUpConjugations.has(card.id) && (
                    <p className="text-xs text-gray-400 italic">No conjugation data found for this card.</p>
                  )}

                  {/* Examples section */}
                  {card.examples && card.examples.length > 0 && (
                    <div className="mt-2 border-t pt-2">
                      <p className="text-xs font-medium text-gray-500 mb-1">Examples ({card.examples.length})</p>
                      <div className="space-y-1">
                        {card.examples.map((ex) => (
                          <div key={ex.id} className="flex items-start gap-2 text-sm">
                            <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full mt-0.5 ${
                              ex.direction === 'source-to-target'
                                ? 'bg-blue-50 text-blue-600'
                                : 'bg-purple-50 text-purple-600'
                            }`}>
                              {ex.direction === 'source-to-target' ? 'S→T' : 'T→S'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-800">{ex.sourceText}</p>
                              <p className="text-gray-500">{ex.targetText}</p>
                            </div>
                            <button
                              onClick={async () => {
                                await removeExampleFromCardAndCompanions(card.deckId, card.id, ex.id)
                                onUpdate()
                              }}
                              className="shrink-0 text-xs text-red-400 hover:text-red-600 mt-0.5"
                              title="Delete example"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 rounded text-sm border disabled:opacity-30 hover:bg-gray-50"
          >
            Prev
          </button>
          <span className="text-sm text-gray-500">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 rounded text-sm border disabled:opacity-30 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
