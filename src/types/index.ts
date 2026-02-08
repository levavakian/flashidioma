// Core types for FlashIdioma
// See README.md for the data model specification

export type CardDirection = 'source-to-target' | 'target-to-source'

export type LLMProvider = 'anthropic' | 'openai'

export interface Card {
  id: string
  deckId: string
  frontText: string
  backText: string
  direction: CardDirection
  tags: string[]
  notes: string
  verbData?: VerbData
  fsrs: FSRSState
  createdAt: string // ISO date
  source: 'manual' | 'imported' | 'practice'
}

export interface FSRSState {
  stability: number
  difficulty: number
  dueDate: string // ISO date
  lastReview: string | null // ISO date
  reviewCount: number
  lapses: number
  state: 'new' | 'learning' | 'review' | 'relearning'
  elapsedDays: number
  scheduledDays: number
  reps: number
}

export interface Deck {
  id: string
  name: string
  targetLanguage: string
  createdAt: string // ISO date
  constructChecklist: ConstructChecklist
  newCardBatchSize: number
  currentBatchCardIds: string[]
}

export interface ConstructChecklist {
  [constructId: string]: boolean
}

export interface PracticeSentence {
  id: string
  deckId: string
  sourceText: string
  targetText: string
  selectedVerb: string | null
  selectedAdjective: string | null
  selectedConstruct: string | null
  createdAt: string // ISO date
}

export interface SideDeckCard {
  id: string
  text: string
  targetLanguage: string
  targetDeckId: string | null
  createdAt: string // ISO date
}

export interface Settings {
  id: string // singleton, always 'settings'
  llmProvider: LLMProvider
  llmApiKey: string
  llmModel: string
  uiPreferences: UIPreferences
}

export interface UIPreferences {
  // Placeholder for future UI preferences
}

export interface VerbData {
  infinitive: string
  language: string
  tenses: TenseData[]
}

export interface TenseData {
  tenseId: string
  tenseName: string
  description: string
  conjugations: ConjugationForm[]
}

export interface ConjugationForm {
  person: string
  form: string
  miniTranslation: string
}

export interface ReviewHistory {
  id: string
  cardId: string
  deckId: string
  grade: number // 1=Again, 2=Hard, 3=Good, 4=Easy
  reviewedAt: string // ISO date
  previousState: FSRSState
  newState: FSRSState
}

// Language module interface for multi-language support
export interface LanguageModule {
  id: string
  name: string
  constructs: ConstructDefinition[]
  persons: string[]
}

export interface ConstructDefinition {
  id: string
  name: string
  category: string // e.g. 'tense', 'mood'
  description: string
}

// Import/export types
export interface AppExport {
  version: number
  exportedAt: string
  settings: Settings
  decks: Deck[]
  cards: Card[]
  reviewHistory: ReviewHistory[]
  practiceSentences: PracticeSentence[]
  sideDeckCards: SideDeckCard[]
}

// Importable deck catalog
export interface ImportableDeck {
  id: string
  name: string
  description: string
  language: string
  cardCount: number
}
