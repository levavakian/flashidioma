import { useState, useEffect, useMemo } from 'react'
import { getAllVerbInfinitives, lookupConjugationExact } from '../../services/conjugationLookup'
import { getPrebuiltDeckCards } from '../../services/importDeck'
import ConjugationView from '../cards/ConjugationView'
import type { VerbData } from '../../types'

interface VerbEntry {
  infinitive: string
  translation: string
}

const PAGE_SIZE = 50

function normalizeForSearch(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export default function ConjugationBrowserPage() {
  const [verbs, setVerbs] = useState<VerbEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [expandedVerb, setExpandedVerb] = useState<string | null>(null)
  const [expandedVerbData, setExpandedVerbData] = useState<VerbData | null>(null)

  useEffect(() => {
    async function load() {
      const [infinitives, deckCards] = await Promise.all([
        getAllVerbInfinitives(),
        getPrebuiltDeckCards('spanish-frequency'),
      ])

      const translationMap = new Map<string, string>()
      for (const card of deckCards) {
        if (card.pos === 'v' && card.translation) {
          translationMap.set(card.word, card.translation)
        }
      }

      const entries: VerbEntry[] = infinitives.map((inf) => ({
        infinitive: inf,
        translation: translationMap.get(inf) ?? '',
      }))

      // Sort: verbs with translations first (alphabetically), then without
      entries.sort((a, b) => {
        if (a.translation && !b.translation) return -1
        if (!a.translation && b.translation) return 1
        return a.infinitive.localeCompare(b.infinitive)
      })

      setVerbs(entries)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    if (!search) return verbs
    const q = normalizeForSearch(search)
    return verbs.filter(
      (v) =>
        normalizeForSearch(v.infinitive).includes(q) ||
        v.translation.toLowerCase().includes(q)
    )
  }, [verbs, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(0)
  }

  const toggleExpand = async (infinitive: string) => {
    if (expandedVerb === infinitive) {
      setExpandedVerb(null)
      setExpandedVerbData(null)
      return
    }
    setExpandedVerb(infinitive)
    setExpandedVerbData(null)
    const data = await lookupConjugationExact(infinitive)
    setExpandedVerbData(data)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading conjugation database...</div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Conjugation Database</h2>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search verbs or translations..."
          className="flex-1 border rounded px-3 py-2"
        />
        <span className="text-sm text-gray-400 self-center whitespace-nowrap">
          {filtered.length} verb{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {filtered.length === 0 && (
        <p className="text-gray-500 text-sm">No verbs match your search.</p>
      )}

      <div className="space-y-2">
        {pageItems.map((verb) => {
          const isExpanded = expandedVerb === verb.infinitive
          return (
            <div key={verb.infinitive} className="bg-white rounded-lg border">
              <button
                onClick={() => toggleExpand(verb.infinitive)}
                className="w-full text-left p-3 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{verb.infinitive}</span>
                    {verb.translation && (
                      <>
                        <span className="text-gray-400 shrink-0">&mdash;</span>
                        <span className="text-gray-600 truncate">{verb.translation}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-gray-400 ml-2 shrink-0 text-sm">
                  {isExpanded ? '\u25BC' : '\u25B6'}
                </span>
              </button>

              {isExpanded && (
                <div className="border-t px-3 pb-3">
                  {expandedVerbData ? (
                    <ConjugationView verbData={expandedVerbData} />
                  ) : (
                    <div className="py-3 text-sm text-gray-400">Loading conjugations...</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

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
