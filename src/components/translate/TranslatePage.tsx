import { useState, useEffect, useRef, useCallback } from 'react'
import { translateText, isOnline } from '../../services/translate'
import { createCard, createCardBothDirections } from '../../services/card'
import { lookupConjugation } from '../../services/conjugationLookup'
import { checkDuplicate } from '../../services/deduplication'
import { addToSideDeck, getSideDeckCards, removeSideDeckCard } from '../../services/sideDeck'
import { getAllDecks } from '../../services/deck'
import { addTranslationHistoryEntry, getTranslationHistoryEntries } from '../../services/translationHistory'
import { getSettings, updateSettings } from '../../db'
import type { Card, Deck, SideDeckCard, TranslationHistoryEntry } from '../../types'

type AddDirection = 'source-to-target' | 'target-to-source' | 'both'
type TranslateTab = 'translate' | 'history'

function getDeckTargetLanguageCode(deck: Deck): string | null {
  switch (deck.targetLanguage.toLowerCase()) {
    case 'spanish':
      return 'es'
    case 'english':
      return 'en'
    default:
      return null
  }
}

function getCanonicalCardTexts(
  deck: Deck,
  inputText: string,
  translatedText: string,
  sourceLang: string,
  targetLang: string
) {
  const deckTargetLang = getDeckTargetLanguageCode(deck)
  if (!deckTargetLang) {
    return { frontText: inputText, backText: translatedText }
  }

  if (targetLang === deckTargetLang) {
    return { frontText: inputText, backText: translatedText }
  }

  if (sourceLang === deckTargetLang || sourceLang === 'auto') {
    return { frontText: translatedText, backText: inputText }
  }

  return { frontText: inputText, backText: translatedText }
}

function getHistoryDirectionLabel(direction: AddDirection): string {
  switch (direction) {
    case 'source-to-target':
      return 'Source to target'
    case 'target-to-source':
      return 'Target to source'
    case 'both':
      return 'Both directions'
  }
}

export default function TranslatePage() {
  const [activeTab, setActiveTab] = useState<TranslateTab>('translate')
  const [inputText, setInputText] = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [sourceLang, setSourceLang] = useState('en')
  const [targetLang, setTargetLang] = useState('es')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [online, setOnline] = useState(isOnline())
  const [decks, setDecks] = useState<Deck[]>([])
  const [selectedDeckId, setSelectedDeckId] = useState('')
  const [addedMessage, setAddedMessage] = useState('')
  const [sideDeck, setSideDeck] = useState<SideDeckCard[]>([])
  const [showSideDeck, setShowSideDeck] = useState(false)
  const [duplicates, setDuplicates] = useState<Card[]>([])
  const [pendingDirection, setPendingDirection] = useState<AddDirection | null>(null)
  const [history, setHistory] = useState<TranslationHistoryEntry[]>([])
  const prefsLoaded = useRef(false)
  const selectedDeck = decks.find((deck) => deck.id === selectedDeckId) ?? null

  const loadHistory = useCallback(async () => {
    setHistory(await getTranslationHistoryEntries())
  }, [])

  useEffect(() => {
    // Load persisted preferences and decks
    Promise.all([getAllDecks(), getSettings()]).then(([d, settings]) => {
      setDecks(d)
      const prefs = settings.uiPreferences
      if (prefs.translateSourceLang) setSourceLang(prefs.translateSourceLang)
      if (prefs.translateTargetLang) setTargetLang(prefs.translateTargetLang)
      // Use persisted deck if it still exists, otherwise fall back to first deck
      const savedDeckExists = prefs.translateDeckId && d.some(dk => dk.id === prefs.translateDeckId)
      if (savedDeckExists) {
        setSelectedDeckId(prefs.translateDeckId!)
      } else if (d.length > 0) {
        setSelectedDeckId(d[0].id)
      }
      prefsLoaded.current = true
    })
    getSideDeckCards().then(setSideDeck)
    loadHistory()

    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [loadHistory])

  const persistPrefs = (updates: Record<string, string>) => {
    if (!prefsLoaded.current) return
    getSettings().then(s => {
      updateSettings({ uiPreferences: { ...s.uiPreferences, ...updates } })
    })
  }

  const handleSourceLang = (value: string) => {
    setSourceLang(value)
    persistPrefs({ translateSourceLang: value })
  }

  const handleTargetLang = (value: string) => {
    setTargetLang(value)
    persistPrefs({ translateTargetLang: value })
  }

  const handleDeckChange = (value: string) => {
    setSelectedDeckId(value)
    setDuplicates([])
    setPendingDirection(null)
    persistPrefs({ translateDeckId: value })
  }

  const clearDuplicateWarning = () => {
    setDuplicates([])
    setPendingDirection(null)
  }

  const handleTranslate = async () => {
    const text = inputText.trim()
    if (!text) return

    setError('')
    setTranslatedText('')
    setAddedMessage('')
    clearDuplicateWarning()
    setLoading(true)

    try {
      const result = await translateText(text, sourceLang, targetLang)
      setTranslatedText(result.translatedText)
    } catch {
      await addToSideDeck(text, targetLang, selectedDeckId || null)
      const updated = await getSideDeckCards()
      setSideDeck(updated)
      setInputText('')
      setAddedMessage('Translation did not succeed — added to queue for later retry')
    } finally {
      setLoading(false)
    }
  }

  const performAddCard = async (direction: AddDirection, skipDuplicateCheck: boolean) => {
    if (!selectedDeckId) {
      setError('Please select a deck first.')
      return
    }
    if (!selectedDeck) {
      setError('Selected deck not found.')
      return
    }

    const front = inputText.trim()
    const back = translatedText.trim()
    if (!front || !back) return

    const { frontText: cardFront, backText: cardBack } = getCanonicalCardTexts(
      selectedDeck,
      front,
      back,
      sourceLang,
      targetLang
    )

    if (!skipDuplicateCheck) {
      const dups = await checkDuplicate(selectedDeckId, cardBack)
      if (dups.length > 0) {
        setDuplicates(dups)
        setPendingDirection(direction)
        return
      }
    }

    let cardIds: string[]
    if (direction === 'both') {
      // createCardBothDirections auto-lookups verbData from static DB
      const cards = await createCardBothDirections({
        deckId: selectedDeckId,
        frontText: cardFront,
        backText: cardBack,
      })
      cardIds = cards.map((card) => card.id)
      setAddedMessage('Added 2 cards (both directions)')
    } else {
      // Look up conjugation data — try both texts since either could be the Spanish verb
      const verbData = (await lookupConjugation(cardBack)) ?? (await lookupConjugation(cardFront)) ?? undefined
      const card = await createCard({
        deckId: selectedDeckId,
        frontText: cardFront,
        backText: cardBack,
        direction,
        ...(verbData ? { verbData } : {}),
      })
      cardIds = [card.id]
      setAddedMessage('Added 1 card')
    }

    await addTranslationHistoryEntry({
      deckId: selectedDeckId,
      deckName: selectedDeck.name,
      frontText: cardFront,
      backText: cardBack,
      direction,
      cardIds,
    })
    await loadHistory()
    setInputText('')
    setTranslatedText('')
    clearDuplicateWarning()
  }

  const handleAddCard = async (direction: AddDirection) => {
    await performAddCard(direction, false)
  }

  const handleAddDuplicateAnyway = async () => {
    if (!pendingDirection) return
    await performAddCard(pendingDirection, true)
  }

  const handleSaveToSideDeck = async () => {
    const text = inputText.trim()
    if (!text) return

    await addToSideDeck(text, targetLang, selectedDeckId || null)
    const updated = await getSideDeckCards()
    setSideDeck(updated)
    setInputText('')
    setAddedMessage('Saved to side deck for later translation')
  }

  const handleBatchTranslate = async () => {
    if (!isOnline()) {
      setError('Cannot batch translate while offline.')
      return
    }

    setLoading(true)
    setError('')

    for (const card of sideDeck) {
      try {
        const result = await translateText(card.text, 'auto', card.targetLanguage)
        if (card.targetDeckId) {
          const verbData = (await lookupConjugation(result.translatedText)) ?? undefined
          await createCard({
            deckId: card.targetDeckId,
            frontText: card.text,
            backText: result.translatedText,
            direction: 'source-to-target',
            ...(verbData ? { verbData } : {}),
          })
        }
        await removeSideDeckCard(card.id)
      } catch {
        // Skip failed translations
      }
    }

    const updated = await getSideDeckCards()
    setSideDeck(updated)
    setLoading(false)
    setAddedMessage('Batch translation complete')
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Translate</h2>

      <div className="flex border-b mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('translate')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            activeTab === 'translate'
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Translate
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            activeTab === 'history'
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          History ({history.length})
        </button>
      </div>

      {activeTab === 'translate' ? (
        <>
          {!online && (
            <div className="bg-yellow-50 border border-yellow-200 px-3 py-2 rounded mb-3 text-sm text-yellow-800">
              You are offline. Translation is unavailable. You can enter translations manually or save to the side deck.
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 px-3 py-2 rounded mb-3 text-sm">{error}</div>
          )}

          {addedMessage && (
            <div className="bg-green-50 text-green-600 px-3 py-2 rounded mb-3 text-sm">{addedMessage}</div>
          )}

          <div className="bg-white rounded-lg shadow border p-4 space-y-3">
        <div className="flex gap-2 items-center">
          <select
            value={sourceLang}
            onChange={(e) => handleSourceLang(e.target.value)}
            className="flex-1 border rounded px-2 py-2 text-sm"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="auto">Auto-detect</option>
          </select>
          <button
            onClick={() => {
              if (sourceLang !== 'auto') {
                const newSource = targetLang
                const newTarget = sourceLang
                setSourceLang(newSource)
                setTargetLang(newTarget)
                persistPrefs({ translateSourceLang: newSource, translateTargetLang: newTarget })
              }
            }}
            className="text-gray-400 hover:text-gray-600 px-2 py-1"
            title="Swap languages"
          >
            &#8646;
          </button>
          <select
            value={targetLang}
            onChange={(e) => handleTargetLang(e.target.value)}
            className="flex-1 border rounded px-2 py-2 text-sm"
          >
            <option value="es">Spanish</option>
            <option value="en">English</option>
          </select>
        </div>

        <textarea
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value)
            clearDuplicateWarning()
          }}
          placeholder="Enter text to translate..."
          className="w-full border rounded px-3 py-2 min-h-[80px]"
        />

        <div className="flex gap-2">
          <button
            onClick={handleTranslate}
            aria-label="Translate text"
            disabled={loading || !inputText.trim()}
            className="bg-blue-500 text-white px-4 py-2 rounded font-medium hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Translating...' : 'Translate'}
          </button>
          {!online && (
            <button
              onClick={handleSaveToSideDeck}
              disabled={!inputText.trim()}
              className="bg-gray-500 text-white px-4 py-2 rounded font-medium hover:bg-gray-600 disabled:opacity-50"
            >
              Save to Side Deck
            </button>
          )}
        </div>

        <div className="mt-3">
          <label htmlFor="translation-text" className="block text-sm font-medium text-gray-700 mb-1">
            Translation
          </label>
          <textarea
            id="translation-text"
            value={translatedText}
            onChange={(e) => {
              setTranslatedText(e.target.value)
              clearDuplicateWarning()
            }}
            placeholder={
              online
                ? 'Translation will appear here, or you can edit/add one manually...'
                : 'Enter the translation manually...'
            }
            className="w-full border rounded px-3 py-2 min-h-[80px]"
          />

          {duplicates.length > 0 && (
            <div className="mt-3 bg-yellow-50 border border-yellow-200 px-3 py-2 rounded text-sm">
              <p className="font-medium text-yellow-800">Duplicate detected!</p>
              <p className="text-yellow-700 mt-1">Similar card(s) already exist:</p>
              <ul className="mt-1 text-yellow-700">
                {duplicates.map((duplicate) => (
                  <li key={duplicate.id}>
                    "{duplicate.frontText}" &rarr; "{duplicate.backText}"
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleAddDuplicateAnyway}
                  className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600"
                >
                  Add Anyway
                </button>
                <button
                  type="button"
                  onClick={clearDuplicateWarning}
                  className="text-yellow-700 px-3 py-1 rounded text-sm hover:bg-yellow-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="mt-2 space-y-2">
            <label className="block text-sm font-medium text-gray-700">Add to deck</label>
            <select
              value={selectedDeckId}
              onChange={(e) => handleDeckChange(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              {decks.length === 0 && <option value="">No decks available</option>}
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>{deck.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => handleAddCard('source-to-target')}
                disabled={!selectedDeckId || !inputText.trim() || !translatedText.trim()}
                className="flex-1 bg-green-500 text-white py-2 rounded text-sm font-medium hover:bg-green-600 disabled:opacity-50"
              >
                S &rarr; T
              </button>
              <button
                onClick={() => handleAddCard('target-to-source')}
                disabled={!selectedDeckId || !inputText.trim() || !translatedText.trim()}
                className="flex-1 bg-green-500 text-white py-2 rounded text-sm font-medium hover:bg-green-600 disabled:opacity-50"
              >
                T &rarr; S
              </button>
              <button
                onClick={() => handleAddCard('both')}
                disabled={!selectedDeckId || !inputText.trim() || !translatedText.trim()}
                className="flex-1 bg-green-600 text-white py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                Both
              </button>
            </div>
          </div>
        </div>
      </div>

          {/* Side Deck section */}
          <div className="mt-6">
            <button
              onClick={() => setShowSideDeck(!showSideDeck)}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              Side Deck ({sideDeck.length} pending) {showSideDeck ? '▲' : '▼'}
            </button>

            {showSideDeck && (
              <div className="mt-2 bg-white rounded-lg shadow border p-4">
                {sideDeck.length === 0 ? (
                  <p className="text-gray-500 text-sm">No cards pending translation.</p>
                ) : (
                  <>
                    <button
                      onClick={handleBatchTranslate}
                      disabled={!online || loading}
                      className="mb-3 bg-blue-500 text-white px-4 py-1 rounded text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
                    >
                      Batch Translate All
                    </button>
                    <div className="space-y-2">
                      {sideDeck.map((card) => (
                        <div key={card.id} className="flex items-center justify-between border-b pb-2">
                          <span className="text-sm">{card.text}</span>
                          <button
                            onClick={async () => {
                              await removeSideDeckCard(card.id)
                              setSideDeck(await getSideDeckCards())
                            }}
                            className="text-red-400 hover:text-red-600 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg shadow border p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="font-semibold text-gray-900">Added card history</h3>
              <p className="text-sm text-gray-500">Newest first, up to 100 entries.</p>
            </div>
          </div>

          {history.length === 0 ? (
            <p className="text-gray-500 text-sm">No cards have been added from translation yet.</p>
          ) : (
            <div role="list" aria-label="Translation history" className="space-y-3">
              {history.map((entry) => (
                <div key={entry.id} role="listitem" className="border rounded-lg p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 break-words">
                        {entry.frontText} <span className="text-gray-400">&rarr;</span> {entry.backText}
                      </p>
                      <p className="text-sm text-gray-500">
                        {entry.deckName} · {getHistoryDirectionLabel(entry.direction)}
                      </p>
                    </div>
                    <time className="text-xs text-gray-400 whitespace-nowrap" dateTime={entry.createdAt}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </time>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
