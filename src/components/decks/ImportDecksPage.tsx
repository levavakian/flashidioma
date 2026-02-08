import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getImportableDecks, importPrebuiltDeck, getPrebuiltDeckCards } from '../../services/importDeck'
import type { ProcessedCard } from '../../services/importDeck'
import { getAllDecks, createDeck } from '../../services/deck'
import type { Deck, ImportableDeck } from '../../types'

const PREVIEW_PAGE_SIZE = 50

export default function ImportDecksPage() {
  const navigate = useNavigate()
  const [importableDecks, setImportableDecks] = useState<ImportableDeck[]>([])
  const [userDecks, setUserDecks] = useState<Deck[]>([])
  const [selectedDeckId, setSelectedDeckId] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [error, setError] = useState('')
  const [limit, setLimit] = useState(500)
  const [showNewDeck, setShowNewDeck] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')

  // Preview state
  const [previewDeckId, setPreviewDeckId] = useState<string | null>(null)
  const [previewCards, setPreviewCards] = useState<ProcessedCard[]>([])
  const [previewSearch, setPreviewSearch] = useState('')
  const [previewPage, setPreviewPage] = useState(0)
  const [loadingPreview, setLoadingPreview] = useState(false)

  const loadDecks = async () => {
    const d = await getAllDecks()
    setUserDecks(d)
    if (d.length > 0 && !selectedDeckId) setSelectedDeckId(d[0].id)
  }

  useEffect(() => {
    getImportableDecks().then(setImportableDecks)
    loadDecks()
  }, [])

  const handleImport = async (importableDeckId: string) => {
    if (!selectedDeckId) {
      setError('Please select a target deck first.')
      return
    }
    setImporting(true)
    setError('')
    setResult(null)

    try {
      const res = await importPrebuiltDeck(importableDeckId, selectedDeckId, limit || undefined)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const handlePreview = async (deckId: string) => {
    if (previewDeckId === deckId) {
      setPreviewDeckId(null)
      return
    }
    setLoadingPreview(true)
    try {
      const cards = await getPrebuiltDeckCards(deckId)
      setPreviewCards(cards)
      setPreviewDeckId(deckId)
      setPreviewSearch('')
      setPreviewPage(0)
    } finally {
      setLoadingPreview(false)
    }
  }

  const filteredPreview = useMemo(() => {
    if (!previewSearch) return previewCards
    const q = previewSearch.toLowerCase()
    return previewCards.filter(
      (c) =>
        c.word.toLowerCase().includes(q) ||
        c.translation.toLowerCase().includes(q) ||
        c.pos.toLowerCase().includes(q)
    )
  }, [previewCards, previewSearch])

  const previewTotalPages = Math.ceil(filteredPreview.length / PREVIEW_PAGE_SIZE)
  const previewPageItems = filteredPreview.slice(
    previewPage * PREVIEW_PAGE_SIZE,
    (previewPage + 1) * PREVIEW_PAGE_SIZE
  )

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate('/')} className="text-blue-500 hover:text-blue-700">
          &larr; Back
        </button>
        <h2 className="text-2xl font-bold">Import Pre-built Decks</h2>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-3 py-2 rounded mb-3 text-sm">{error}</div>
      )}

      {result && (
        <div className="bg-green-50 text-green-600 px-3 py-2 rounded mb-3 text-sm">
          Imported {result.imported} cards ({result.imported * 2} total with both directions), skipped {result.skipped} duplicates.
        </div>
      )}

      <div className="mb-4 bg-white rounded-lg border p-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Import into deck</label>
        <div className="flex gap-2">
          <select
            value={selectedDeckId}
            onChange={(e) => setSelectedDeckId(e.target.value)}
            className="flex-1 border rounded px-3 py-2"
          >
            {userDecks.length === 0 && <option value="">No decks available</option>}
            {userDecks.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowNewDeck(true)}
            className="bg-gray-100 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-200 whitespace-nowrap"
          >
            + New
          </button>
        </div>

        {showNewDeck && (
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && newDeckName.trim()) {
                  const deck = await createDeck(newDeckName.trim())
                  setSelectedDeckId(deck.id)
                  setNewDeckName('')
                  setShowNewDeck(false)
                  await loadDecks()
                }
              }}
              placeholder="New deck name"
              className="flex-1 border rounded px-3 py-2"
              autoFocus
            />
            <button
              onClick={async () => {
                if (!newDeckName.trim()) return
                const deck = await createDeck(newDeckName.trim())
                setSelectedDeckId(deck.id)
                setNewDeckName('')
                setShowNewDeck(false)
                await loadDecks()
              }}
              className="bg-blue-500 text-white px-3 py-2 rounded text-sm"
            >
              Create
            </button>
            <button
              onClick={() => { setShowNewDeck(false); setNewDeckName('') }}
              className="text-gray-500 px-3 py-2 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        )}

        <label className="block text-sm font-medium text-gray-700 mt-3 mb-1">
          Number of words to import (by frequency)
        </label>
        <input
          type="number"
          value={limit}
          onChange={(e) => setLimit(parseInt(e.target.value) || 0)}
          min={0}
          className="w-full border rounded px-3 py-2"
          placeholder="Leave 0 for all"
        />
        <p className="text-xs text-gray-400 mt-1">
          Each word creates 2 cards (one per direction).
        </p>
      </div>

      <div className="space-y-3">
        {importableDecks.map((deck) => (
          <div key={deck.id} className="bg-white rounded-lg shadow border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">{deck.name}</h3>
                <p className="text-sm text-gray-500">{deck.description}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {deck.cardCount.toLocaleString()} words available
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePreview(deck.id)}
                  disabled={loadingPreview}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded font-medium hover:bg-gray-200 disabled:opacity-50"
                >
                  {previewDeckId === deck.id ? 'Hide Preview' : loadingPreview ? 'Loading...' : 'Preview'}
                </button>
                <button
                  onClick={() => handleImport(deck.id)}
                  disabled={importing || !selectedDeckId}
                  className="bg-blue-500 text-white px-4 py-2 rounded font-medium hover:bg-blue-600 disabled:opacity-50"
                >
                  {importing ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>

            {/* Preview section */}
            {previewDeckId === deck.id && (
              <div className="mt-4 border-t pt-4">
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={previewSearch}
                    onChange={(e) => { setPreviewSearch(e.target.value); setPreviewPage(0) }}
                    placeholder="Search words..."
                    className="flex-1 border rounded px-3 py-2 text-sm"
                  />
                  <span className="text-sm text-gray-400 self-center whitespace-nowrap">
                    {filteredPreview.length} words
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-1 pr-3 w-12">#</th>
                        <th className="py-1 pr-3">Word</th>
                        <th className="py-1 pr-3">Translation</th>
                        <th className="py-1">POS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewPageItems.map((card, idx) => (
                        <tr key={`${card.word}-${idx}`} className="border-b border-gray-50">
                          <td className="py-1.5 pr-3 text-gray-400">
                            {previewPage * PREVIEW_PAGE_SIZE + idx + 1}
                          </td>
                          <td className="py-1.5 pr-3 font-medium">{card.word}</td>
                          <td className="py-1.5 pr-3 text-gray-600">{card.translation}</td>
                          <td className="py-1.5">
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {card.pos}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {previewTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <button
                      onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}
                      disabled={previewPage === 0}
                      className="px-3 py-1 rounded text-sm border disabled:opacity-30 hover:bg-gray-50"
                    >
                      Prev
                    </button>
                    <span className="text-sm text-gray-500">
                      {previewPage + 1} / {previewTotalPages}
                    </span>
                    <button
                      onClick={() => setPreviewPage((p) => Math.min(previewTotalPages - 1, p + 1))}
                      disabled={previewPage >= previewTotalPages - 1}
                      className="px-3 py-1 rounded text-sm border disabled:opacity-30 hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
