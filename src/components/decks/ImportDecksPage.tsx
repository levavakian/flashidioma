import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getImportableDecks, importPrebuiltDeck } from '../../services/importDeck'
import { getAllDecks } from '../../services/deck'
import type { Deck, ImportableDeck } from '../../types'

export default function ImportDecksPage() {
  const navigate = useNavigate()
  const [importableDecks, setImportableDecks] = useState<ImportableDeck[]>([])
  const [userDecks, setUserDecks] = useState<Deck[]>([])
  const [selectedDeckId, setSelectedDeckId] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [error, setError] = useState('')
  const [limit, setLimit] = useState(500)

  useEffect(() => {
    getImportableDecks().then(setImportableDecks)
    getAllDecks().then((d) => {
      setUserDecks(d)
      if (d.length > 0) setSelectedDeckId(d[0].id)
    })
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
          Imported {result.imported} cards, skipped {result.skipped} duplicates.
        </div>
      )}

      <div className="mb-4 bg-white rounded-lg border p-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Import into deck</label>
        <select
          value={selectedDeckId}
          onChange={(e) => setSelectedDeckId(e.target.value)}
          className="w-full border rounded px-3 py-2"
        >
          {userDecks.length === 0 && <option value="">No decks available</option>}
          {userDecks.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <label className="block text-sm font-medium text-gray-700 mt-3 mb-1">
          Number of cards to import (by frequency)
        </label>
        <input
          type="number"
          value={limit}
          onChange={(e) => setLimit(parseInt(e.target.value) || 0)}
          min={0}
          className="w-full border rounded px-3 py-2"
          placeholder="Leave 0 for all"
        />
      </div>

      <div className="space-y-3">
        {importableDecks.map((deck) => (
          <div key={deck.id} className="bg-white rounded-lg shadow border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">{deck.name}</h3>
                <p className="text-sm text-gray-500">{deck.description}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {deck.cardCount.toLocaleString()} cards available
                </p>
              </div>
              <button
                onClick={() => handleImport(deck.id)}
                disabled={importing || !selectedDeckId}
                className="bg-blue-500 text-white px-4 py-2 rounded font-medium hover:bg-blue-600 disabled:opacity-50"
              >
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
