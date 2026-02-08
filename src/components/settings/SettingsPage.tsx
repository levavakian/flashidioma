import { useEffect, useState, useRef } from 'react'
import { getSettings, updateSettings, db } from '../../db'
import { exportAppState, importAppState, downloadJson } from '../../services/exportImport'
import { getInstallPrompt, clearInstallPrompt } from '../../pwaInstall'
import type { LLMProvider } from '../../types'

export default function SettingsPage() {
  const [provider, setProvider] = useState<LLMProvider>('anthropic')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [installPrompt, setInstallPrompt] = useState(() => getInstallPrompt())
  const [stats, setStats] = useState({ decks: 0, cards: 0, reviews: 0 })

  const loadStats = async () => {
    const [decks, cards, reviews] = await Promise.all([
      db.decks.count(),
      db.cards.count(),
      db.reviewHistory.count(),
    ])
    setStats({ decks, cards, reviews })
  }

  useEffect(() => {
    getSettings().then((s) => {
      setProvider(s.llmProvider)
      setApiKey(s.llmApiKey)
      setModel(s.llmModel)
    })

    loadStats()

    const handler = () => {
      setInstallPrompt(getInstallPrompt())
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleSave = async () => {
    setError('')
    setSaved(false)
    try {
      await updateSettings({
        llmProvider: provider,
        llmApiKey: apiKey,
        llmModel: model,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    }
  }

  const handleExport = async () => {
    setError('')
    try {
      const data = await exportAppState()
      const filename = `flashidioma-backup-${new Date().toISOString().split('T')[0]}.json`
      downloadJson(data, filename)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('')
    setImportMessage('')
    const file = e.target.files?.[0]
    if (!file) return

    if (!confirm('This will replace ALL existing data (decks, cards, review history, settings). Continue?')) {
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    try {
      const text = await file.text()
      const data = JSON.parse(text)
      await importAppState(data)
      setImportMessage('Import successful! All data has been restored.')
      // Reload settings
      const s = await getSettings()
      setProvider(s.llmProvider)
      setApiKey(s.llmApiKey)
      setModel(s.llmModel)
      await loadStats()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClearAll = async () => {
    if (!confirm('This will permanently delete ALL data. This cannot be undone. Continue?')) return
    if (!confirm('Are you absolutely sure? Export a backup first if needed.')) return

    await db.transaction('rw', [db.decks, db.cards, db.reviewHistory, db.practiceSentences, db.sideDeckCards, db.settings], async () => {
      await db.decks.clear()
      await db.cards.clear()
      await db.reviewHistory.clear()
      await db.practiceSentences.clear()
      await db.sideDeckCards.clear()
      await db.settings.clear()
    })
    await loadStats()
    setImportMessage('All data has been cleared.')
  }

  const handleInstall = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    clearInstallPrompt()
    setInstallPrompt(null)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Settings</h2>

      {error && (
        <div className="bg-red-50 text-red-600 px-3 py-2 rounded text-sm">{error}</div>
      )}

      {/* Stats */}
      <div className="bg-white rounded-lg shadow border p-4">
        <h3 className="font-semibold text-lg mb-3">Overview</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-blue-500">{stats.decks}</p>
            <p className="text-xs text-gray-500">Decks</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-500">{stats.cards}</p>
            <p className="text-xs text-gray-500">Cards</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-500">{stats.reviews}</p>
            <p className="text-xs text-gray-500">Reviews</p>
          </div>
        </div>
      </div>

      {/* LLM Configuration */}
      <div className="bg-white rounded-lg shadow border p-4">
        <h3 className="font-semibold text-lg mb-3">LLM Configuration</h3>
        <p className="text-sm text-gray-500 mb-3">
          Required for conjugation hydration and practice sentence generation.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as LLMProvider)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder={provider === 'anthropic' ? 'claude-sonnet-4-5-20250929' : 'gpt-4o'}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="bg-blue-500 text-white px-4 py-2 rounded font-medium hover:bg-blue-600"
            >
              Save
            </button>
            {saved && <span className="text-green-600 text-sm">Saved!</span>}
          </div>
        </div>
      </div>

      {/* Export / Import */}
      <div className="bg-white rounded-lg shadow border p-4">
        <h3 className="font-semibold text-lg mb-3">Data Backup</h3>
        <div className="space-y-3">
          <button
            onClick={handleExport}
            className="w-full bg-green-500 text-white py-2 rounded font-medium hover:bg-green-600"
          >
            Export All Data
          </button>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Import from backup file
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="w-full text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Warning: importing will replace all existing data.
            </p>
          </div>

          {importMessage && (
            <div className="bg-green-50 text-green-600 px-3 py-2 rounded text-sm">
              {importMessage}
            </div>
          )}

          <hr />

          <button
            onClick={handleClearAll}
            className="w-full bg-red-50 text-red-600 py-2 rounded font-medium hover:bg-red-100 text-sm"
          >
            Clear All Data
          </button>
        </div>
      </div>

      {/* Install as App */}
      {installPrompt && (
        <div className="bg-white rounded-lg shadow border p-4">
          <h3 className="font-semibold text-lg mb-3">Install as App</h3>
          <p className="text-sm text-gray-500 mb-3">
            Install FlashIdioma as a standalone app for the best experience.
          </p>
          <button
            onClick={handleInstall}
            className="w-full bg-blue-500 text-white py-2 rounded font-medium hover:bg-blue-600"
          >
            Install as App
          </button>
        </div>
      )}

      {/* About */}
      <div className="text-center text-xs text-gray-400 pb-4">
        <p>FlashIdioma - Language Learning Flashcards</p>
        <p>All data stored locally on your device.</p>
      </div>
    </div>
  )
}
