import type { VerbData, TenseData } from '../types'
import { isReflexiveVerb, getBaseInfinitive, reflexifyVerbData } from './reflexive'

interface TenseMetadata {
  tenseId: string
  tenseName: string
  description: string
  persons: string[]
}

interface CompactConjugationData {
  language: string
  generatedAt: string
  verbCount: number
  tenses: TenseMetadata[]
  verbs: Record<string, string[][]>
}

let cachedData: CompactConjugationData | null = null
/** Map from accent-stripped lowercase key → original verb key */
let accentIndex: Map<string, string> | null = null

/** Remove accents/diacritics and lowercase for comparison */
function normalizeForLookup(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

async function loadConjugationData(): Promise<CompactConjugationData> {
  if (cachedData) return cachedData
  const module = await import('../data/spanish-conjugations.json')
  cachedData = module.default as CompactConjugationData

  // Build accent-insensitive index on first load
  accentIndex = new Map()
  for (const key of Object.keys(cachedData.verbs)) {
    accentIndex.set(normalizeForLookup(key), key)
  }

  return cachedData
}

/**
 * Find the verb key in the database, trying exact match first,
 * then accent-insensitive fallback.
 */
function findVerbKey(data: CompactConjugationData, infinitive: string): string | null {
  // Exact match
  if (infinitive in data.verbs) return infinitive
  // Accent-insensitive fallback
  if (accentIndex) {
    const normalized = normalizeForLookup(infinitive)
    const match = accentIndex.get(normalized)
    if (match) return match
  }
  return null
}

/**
 * Build VerbData from the compact format for a given verb key.
 */
function buildVerbData(data: CompactConjugationData, verbKey: string): VerbData {
  const verbForms = data.verbs[verbKey]
  const tenses: TenseData[] = data.tenses.map((meta, tenseIdx) => ({
    tenseId: meta.tenseId,
    tenseName: meta.tenseName,
    description: meta.description,
    conjugations: meta.persons.map((person, personIdx) => ({
      person,
      form: verbForms[tenseIdx]?.[personIdx] ?? '',
      miniTranslation: '',
    })),
  }))

  return {
    infinitive: verbKey,
    language: data.language,
    tenses,
  }
}

/**
 * Look up conjugation data for a verb from the static pre-computed database.
 *
 * Lookup order:
 *   1. Exact match for the requested infinitive
 *   2. Accent-insensitive match
 *   3. For reflexive infinitives ("-se"), fall back to the base form and
 *      synthesize the reflexive table by adding pronouns to each form.
 *
 * Returns VerbData if found, null if neither the verb nor its base is in
 * the database.
 */
export async function lookupConjugation(infinitive: string): Promise<VerbData | null> {
  const data = await loadConjugationData()
  const verbKey = findVerbKey(data, infinitive)
  if (verbKey) return buildVerbData(data, verbKey)

  if (isReflexiveVerb(infinitive)) {
    const baseKey = findVerbKey(data, getBaseInfinitive(infinitive))
    if (baseKey) {
      const base = buildVerbData(data, baseKey)
      const synthesized = reflexifyVerbData(base)
      // Use the originally requested infinitive (preserves user's accents)
      synthesized.infinitive = infinitive
      return synthesized
    }
  }

  return null
}

/**
 * Check if a verb exists in the static conjugation database.
 * Supports accent-insensitive matching and reflexive base-form fallback.
 */
export async function hasConjugation(infinitive: string): Promise<boolean> {
  const data = await loadConjugationData()
  if (findVerbKey(data, infinitive)) return true
  if (isReflexiveVerb(infinitive)) {
    return findVerbKey(data, getBaseInfinitive(infinitive)) !== null
  }
  return false
}

/**
 * Get all verb infinitives in the conjugation database.
 */
export async function getAllVerbInfinitives(): Promise<string[]> {
  const data = await loadConjugationData()
  return Object.keys(data.verbs)
}

/**
 * Look up conjugation data for a verb by its exact key (no accent normalization).
 * Used by the browser page where we already have exact keys.
 */
export async function lookupConjugationExact(verbKey: string): Promise<VerbData | null> {
  const data = await loadConjugationData()
  if (!(verbKey in data.verbs)) return null
  return buildVerbData(data, verbKey)
}
