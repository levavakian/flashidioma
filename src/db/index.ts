import Dexie, { type EntityTable } from 'dexie'
import type {
  Card,
  Deck,
  Settings,
  PracticeSentence,
  SideDeckCard,
  ReviewHistory,
  ConjugationAutoAdd,
} from '../types'

class FlashIdiomaDB extends Dexie {
  cards!: EntityTable<Card, 'id'>
  decks!: EntityTable<Deck, 'id'>
  settings!: EntityTable<Settings, 'id'>
  practiceSentences!: EntityTable<PracticeSentence, 'id'>
  sideDeckCards!: EntityTable<SideDeckCard, 'id'>
  reviewHistory!: EntityTable<ReviewHistory, 'id'>
  conjugationAutoAdds!: EntityTable<ConjugationAutoAdd, 'id'>

  constructor() {
    super('flashidioma')

    this.version(1).stores({
      cards: 'id, deckId, *tags, [deckId+fsrs.state]',
      decks: 'id',
      settings: 'id',
      practiceSentences: 'id, deckId',
      sideDeckCards: 'id',
      reviewHistory: 'id, cardId, deckId, reviewedAt',
    })

    // Only declare new/changed stores in v2 (Dexie best practice)
    this.version(2).stores({
      conjugationAutoAdds: 'id, deckId, [deckId+verbInfinitive], [deckId+addedDate]',
    })
  }
}

export const db = new FlashIdiomaDB()

// When another tab/context requests a DB version upgrade, close this connection
// and reload so the upgrade can proceed. This is critical on Android where
// frozen tabs/PWA shells may hold stale connections.
db.on('versionchange', () => {
  db.close()
  if (typeof window !== 'undefined') {
    window.location.reload()
  }
})

// Log when the DB upgrade is blocked (helps diagnose Android issues)
db.on('blocked', () => {
  console.warn('[FlashIdioma] DB upgrade blocked — another connection is preventing the upgrade')
})

/**
 * Explicitly open the DB (triggers version upgrade if needed).
 * Resolves to true when the DB is ready, false if blocked/timed out.
 * On Android Chrome/PWA, the v1→v2 upgrade can be blocked by old connections
 * from frozen tabs or the PWA shell, causing all DB operations to hang.
 * This detects that situation early so the UI can show a helpful message.
 */
export const dbReady: Promise<boolean> = Promise.race([
  db.open().then(() => true),
  new Promise<boolean>((resolve) =>
    setTimeout(() => {
      console.warn('[FlashIdioma] DB open timed out — likely blocked by another connection')
      resolve(false)
    }, 8000)
  ),
]).catch((err) => {
  console.error('[FlashIdioma] Database failed to open:', err)
  return false
})

const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  llmProvider: 'anthropic',
  llmApiKey: '',
  llmModel: 'claude-sonnet-4-20250514',
  uiPreferences: {},
}

export async function getSettings(): Promise<Settings> {
  const settings = await db.settings.get('settings')
  if (!settings) {
    await db.settings.put(DEFAULT_SETTINGS)
    return DEFAULT_SETTINGS
  }
  return settings
}

export async function updateSettings(
  updates: Partial<Omit<Settings, 'id'>>
): Promise<Settings> {
  const current = await getSettings()
  const updated = { ...current, ...updates }
  await db.settings.put(updated)
  return updated
}
