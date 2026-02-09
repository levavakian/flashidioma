import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createDeck, getAllDecks, updateDeck, deleteDeck } from '../../services/deck'
import { db, dbReady } from '../../db'
import type { Deck } from '../../types'

interface DeckWithCounts extends Deck {
  totalCards: number
  dueCards: number
  newCards: number
}

export default function DecksPage() {
  const [decks, setDecks] = useState<DeckWithCounts[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [dbError, setDbError] = useState<string | null>(null)
  const navigate = useNavigate()

  const loadDecks = async () => {
    const ready = await dbReady
    if (!ready) {
      setDbError('Database is blocked by another tab or old app version. Close all other FlashIdioma tabs, then reload this page.')
      return
    }
    try {
      const allDecks = await getAllDecks()
      const now = new Date()

      const decksWithCounts = await Promise.all(
        allDecks.map(async (deck) => {
          const cards = await db.cards.where('deckId').equals(deck.id).toArray()
          const dueCards = cards.filter(
            (c) => c.fsrs.state !== 'new' && new Date(c.fsrs.dueDate) <= now
          ).length
          const newCards = cards.filter((c) => c.fsrs.state === 'new').length
          return { ...deck, totalCards: cards.length, dueCards, newCards }
        })
      )
      setDecks(decksWithCounts)
    } catch (e) {
      console.error('Failed to load decks:', e)
      setDbError(`Failed to load decks: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  useEffect(() => {
    loadDecks()
  }, [])

  const handleCreate = async () => {
    const name = newDeckName.trim()
    if (!name) return
    try {
      const ready = await dbReady
      if (!ready) {
        setDbError('Database is blocked. Close all other FlashIdioma tabs and reload.')
        return
      }
      await createDeck(name)
      setNewDeckName('')
      setShowCreate(false)
      await loadDecks()
    } catch (e) {
      console.error('Failed to create deck:', e)
      setDbError(`Failed to create deck: ${e instanceof Error ? e.message : 'Unknown error'}. Try closing other tabs and reloading.`)
    }
  }

  const handleRename = async (id: string) => {
    const name = editName.trim()
    if (!name) return
    await updateDeck(id, { name })
    setEditingId(null)
    setEditName('')
    await loadDecks()
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete deck "${name}" and all its cards?`)) return
    await deleteDeck(id)
    await loadDecks()
  }

  return (
    <div>
      {dbError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm font-medium mb-2">{dbError}</p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setDbError(null)
                window.location.reload()
              }}
              className="text-red-600 text-sm underline hover:text-red-800"
            >
              Reload Page
            </button>
            <button
              onClick={async () => {
                // Unregister all service workers to clear stale connections
                if ('serviceWorker' in navigator) {
                  const registrations = await navigator.serviceWorker.getRegistrations()
                  await Promise.all(registrations.map(r => r.unregister()))
                }
                window.location.reload()
              }}
              className="text-red-600 text-sm underline hover:text-red-800"
            >
              Force Reset &amp; Reload
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Your Decks</h2>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/import')}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
          >
            Import
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600"
          >
            + New Deck
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="mb-4 p-4 bg-white rounded-lg shadow border">
          <input
            type="text"
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Deck name"
            className="w-full border rounded px-3 py-2 mb-2"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              className="bg-blue-500 text-white px-4 py-1 rounded text-sm hover:bg-blue-600"
            >
              Create
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewDeckName('') }}
              className="text-gray-500 px-4 py-1 rounded text-sm hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {decks.length === 0 && !showCreate && (
        <p className="text-gray-500">No decks yet. Create one to get started.</p>
      )}

      <div className="space-y-2">
        {decks.map((deck) => (
          <div
            key={deck.id}
            className="bg-white rounded-lg shadow border p-4 cursor-pointer hover:bg-gray-50"
            onClick={() => {
              if (editingId !== deck.id) navigate(`/deck/${deck.id}`)
            }}
          >
            {editingId === deck.id ? (
              <div onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(deck.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="w-full border rounded px-3 py-2 mb-2"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRename(deck.id)}
                    className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-gray-500 px-3 py-1 rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{deck.name}</h3>
                  <div className="flex gap-3 text-sm text-gray-500 mt-1">
                    <span>{deck.totalCards} cards</span>
                    {deck.dueCards > 0 && (
                      <span className="text-orange-500 font-medium">
                        {deck.dueCards} due
                      </span>
                    )}
                    {deck.newCards > 0 && (
                      <span className="text-blue-500">{deck.newCards} new</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => {
                      setEditingId(deck.id)
                      setEditName(deck.name)
                    }}
                    className="text-gray-400 hover:text-gray-600 p-2"
                    title="Rename"
                  >
                    &#9998;
                  </button>
                  <button
                    onClick={() => handleDelete(deck.id, deck.name)}
                    className="text-gray-400 hover:text-red-500 p-2"
                    title="Delete"
                  >
                    &#128465;
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
