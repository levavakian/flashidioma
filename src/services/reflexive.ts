/**
 * Utilities for handling Spanish reflexive verbs.
 *
 * Reflexive verbs have infinitives ending in "-se" (levantarse, vestirse, irse).
 * When conjugated, the reflexive pronoun must be placed correctly:
 *   - Simple tenses: pronoun before verb ("me levanto")
 *   - Compound tenses: pronoun before auxiliary ("me he levantado")
 *   - Affirmative imperative: pronoun attached to end ("levántate")
 */

/** Reflexive pronoun for each grammatical person */
const REFLEXIVE_PRONOUNS: Record<string, string> = {
  'yo': 'me',
  'tú': 'te',
  'él/ella/usted': 'se',
  'usted': 'se',
  'nosotros/as': 'nos',
  'nosotros': 'nos',
  'vosotros/as': 'os',
  'vosotros': 'os',
  'ellos/ellas/ustedes': 'se',
  'ustedes': 'se',
}

/** Compound tense auxiliaries (haber forms) */
const HABER_FORMS = ['he', 'has', 'ha', 'hemos', 'habéis', 'han',
  'había', 'habías', 'habíamos', 'habíais', 'habían',
  'habré', 'habrás', 'habrá', 'habremos', 'habréis', 'habrán',
  'habría', 'habrías', 'habríamos', 'habríais', 'habrían',
  'haya', 'hayas', 'hayamos', 'hayáis', 'hayan',
  'hubiera', 'hubieras', 'hubiéramos', 'hubierais', 'hubieran']

/** Check if a verb infinitive is reflexive (ends in -se) */
export function isReflexiveVerb(infinitive: string): boolean {
  return infinitive.endsWith('se') && infinitive.length > 2
}

/** Get the non-reflexive infinitive (strip -se) */
export function getBaseInfinitive(infinitive: string): string {
  if (!isReflexiveVerb(infinitive)) return infinitive
  return infinitive.slice(0, -2)
}

/** Get the reflexive pronoun for a given person */
export function getReflexivePronoun(person: string): string {
  const normalized = person.toLowerCase().trim()
  return REFLEXIVE_PRONOUNS[normalized] ?? 'se'
}

/**
 * Format a conjugated form with the correct reflexive pronoun placement.
 *
 * @param form - The conjugated verb form (e.g. "levanto", "he levantado")
 * @param person - The grammatical person (e.g. "yo", "tú")
 * @param infinitive - The verb infinitive (e.g. "levantarse")
 * @param tenseId - The tense identifier (e.g. "present", "imperative")
 * @returns The correctly formed reflexive expression (e.g. "me levanto")
 */
export function formatReflexiveForm(
  form: string,
  person: string,
  infinitive: string,
  tenseId: string
): string {
  if (!isReflexiveVerb(infinitive)) return form

  const pronoun = getReflexivePronoun(person)

  // Affirmative imperative: pronoun is attached to the end (e.g. "levántate")
  // The static conjugation data for reflexive verbs in imperative may already
  // have the pronoun attached. Check if the form already ends with a pronoun.
  if (tenseId === 'imperative') {
    const pronounSuffixes = ['me', 'te', 'se', 'nos', 'os']
    const alreadyHasPronoun = pronounSuffixes.some(p => form.endsWith(p))
    if (alreadyHasPronoun) return form
    // Otherwise attach it — this is a simplified approach
    return `${form}${pronoun}`
  }

  // Check if it's a compound tense (form starts with a haber auxiliary)
  const words = form.split(' ')
  if (words.length >= 2) {
    const firstWord = words[0].toLowerCase()
    if (HABER_FORMS.includes(firstWord)) {
      // Compound tense: pronoun goes before the auxiliary
      // "he levantado" → "me he levantado"
      return `${pronoun} ${form}`
    }
  }

  // Simple tense: pronoun goes before the verb
  // "levanto" → "me levanto"
  return `${pronoun} ${form}`
}
