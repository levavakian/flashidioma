import Dexie, { type EntityTable } from 'dexie'
import type {
  Card,
  Deck,
  Settings,
  PracticeSentence,
  SideDeckCard,
  ReviewHistory,
} from '../types'

class FlashIdiomaDB extends Dexie {
  cards!: EntityTable<Card, 'id'>
  decks!: EntityTable<Deck, 'id'>
  settings!: EntityTable<Settings, 'id'>
  practiceSentences!: EntityTable<PracticeSentence, 'id'>
  sideDeckCards!: EntityTable<SideDeckCard, 'id'>
  reviewHistory!: EntityTable<ReviewHistory, 'id'>

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
  }
}

export const db = new FlashIdiomaDB()

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
