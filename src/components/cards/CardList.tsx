import { useState } from 'react'
import { updateCard, deleteCard } from '../../services/card'
import type { Card } from '../../types'

interface Props {
  cards: Card[]
  deckId: string
  onUpdate: () => void
}

export default function CardList({ cards, onUpdate }: Props) {
  const [search, setSearch] = useState('')
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')
  const [editNotes, setEditNotes] = useState('')

  const filtered = search
    ? cards.filter(
        (c) =>
          c.frontText.toLowerCase().includes(search.toLowerCase()) ||
          c.backText.toLowerCase().includes(search.toLowerCase()) ||
          c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : cards

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
    onUpdate()
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

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search cards..."
        className="w-full border rounded px-3 py-2 mb-3"
      />

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
        {filtered.map((card) => (
          <div
            key={card.id}
            className="bg-white rounded-lg border p-3 flex items-center justify-between"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{card.frontText}</span>
                <span className="text-gray-400">&rarr;</span>
                <span className="text-gray-600 truncate">{card.backText}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${stateColor(card.fsrs.state)}`}
                >
                  {stateLabel(card.fsrs.state)}
                </span>
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
            <div className="flex gap-1 ml-2">
              <button
                onClick={() => handleEdit(card)}
                className="text-gray-400 hover:text-gray-600 p-1 text-sm"
                title="Edit"
              >
                &#9998;
              </button>
              <button
                onClick={() => handleDelete(card)}
                className="text-gray-400 hover:text-red-500 p-1 text-sm"
                title="Delete"
              >
                &#128465;
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
