import { useState, useEffect, useRef } from 'react'
import { translateText, isOnline } from '../../services/translate'
import { createCard, createCardBothDirections } from '../../services/card'
import { lookupConjugation } from '../../services/conjugationLookup'
import { addToSideDeck, getSideDeckCards, removeSideDeckCard } from '../../services/sideDeck'
import { getAllDecks } from '../../services/deck'
import { getSettings, updateSettings } from '../../db'
import type { Deck, SideDeckCard } from '../../types'

export default function TranslatePage() {
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
  const prefsLoaded = useRef(false)

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

    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

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
    persistPrefs({ translateDeckId: value })
  }

  const handleTranslate = async () => {
    const text = inputText.trim()
    if (!text) return

    setError('')
    setTranslatedText('')
    setAddedMessage('')
    setLoading(true)

    try {
      const result = await translateText(text, sourceLang, targetLang)
      setTranslatedText(result.translatedText)
    } catch {
      setError('Translation failed. You can enter the translation manually below.')
    } finally {
      setLoading(false)
    }
  }

  const handleAddCard = async (direction: 'source-to-target' | 'target-to-source' | 'both') => {
    if (!selectedDeckId) {
      setError('Please select a deck first.')
      return
    }

    const front = inputText.trim()
    const back = translatedText.trim()
    if (!front || !back) return

    if (direction === 'both') {
      // createCardBothDirections auto-lookups verbData from static DB
      await createCardBothDirections({
        deckId: selectedDeckId,
        frontText: front,
        backText: back,
      })
      setAddedMessage('Added 2 cards (both directions)')
    } else {
      // For single-direction, look up the target language word for conjugation
      const spanishWord = direction === 'source-to-target' ? back : front
      const verbData = (await lookupConjugation(spanishWord)) ?? undefined
      await createCard({
        deckId: selectedDeckId,
        frontText: direction === 'source-to-target' ? front : back,
        backText: direction === 'source-to-target' ? back : front,
        direction,
        ...(verbData ? { verbData } : {}),
      })
      setAddedMessage('Added 1 card')
    }

    setInputText('')
    setTranslatedText('')
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
                const tmp = sourceLang
                handleSourceLang(targetLang)
                handleTargetLang(tmp)
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
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Enter text to translate..."
          className="w-full border rounded px-3 py-2 min-h-[80px]"
        />

        <div className="flex gap-2">
          <button
            onClick={handleTranslate}
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

        {translatedText && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Translation</label>
            <textarea
              value={translatedText}
              onChange={(e) => setTranslatedText(e.target.value)}
              className="w-full border rounded px-3 py-2 min-h-[80px] bg-gray-50"
            />

            <div className="mt-2 space-y-2">
              <label className="block text-sm font-medium text-gray-700">Add to deck</label>
              <select
                value={selectedDeckId}
                onChange={(e) => handleDeckChange(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                {decks.length === 0 && <option value="">No decks available</option>}
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAddCard('source-to-target')}
                  className="flex-1 bg-green-500 text-white py-2 rounded text-sm font-medium hover:bg-green-600"
                >
                  S &rarr; T
                </button>
                <button
                  onClick={() => handleAddCard('target-to-source')}
                  className="flex-1 bg-green-500 text-white py-2 rounded text-sm font-medium hover:bg-green-600"
                >
                  T &rarr; S
                </button>
                <button
                  onClick={() => handleAddCard('both')}
                  className="flex-1 bg-green-600 text-white py-2 rounded text-sm font-medium hover:bg-green-700"
                >
                  Both
                </button>
              </div>
            </div>
          </div>
        )}

        {!translatedText && !online && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Manual translation (offline mode)
            </label>
            <textarea
              value={translatedText}
              onChange={(e) => setTranslatedText(e.target.value)}
              placeholder="Enter the translation manually..."
              className="w-full border rounded px-3 py-2 min-h-[80px]"
            />
            {translatedText && (
              <div className="mt-2 flex gap-2">
                <select
                  value={selectedDeckId}
                  onChange={(e) => handleDeckChange(e.target.value)}
                  className="border rounded px-3 py-2 text-sm"
                >
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleAddCard('both')}
                  className="bg-green-500 text-white px-4 py-2 rounded text-sm font-medium"
                >
                  Add Card
                </button>
              </div>
            )}
          </div>
        )}
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
    </div>
  )
}
