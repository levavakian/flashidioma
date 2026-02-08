import type { VerbData, TenseData } from '../types'

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

async function loadConjugationData(): Promise<CompactConjugationData> {
  if (cachedData) return cachedData
  const module = await import('../data/spanish-conjugations.json')
  cachedData = module.default as CompactConjugationData
  return cachedData
}

/**
 * Look up conjugation data for a verb from the static pre-computed database.
 * Returns VerbData if found, null if the verb is not in the database.
 */
export async function lookupConjugation(infinitive: string): Promise<VerbData | null> {
  const data = await loadConjugationData()
  const verbForms = data.verbs[infinitive]
  if (!verbForms) return null

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
    infinitive,
    language: data.language,
    tenses,
  }
}

/**
 * Check if a verb exists in the static conjugation database.
 */
export async function hasConjugation(infinitive: string): Promise<boolean> {
  const data = await loadConjugationData()
  return infinitive in data.verbs
}
