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

/** Set of reflexive pronoun words for quick lookup */
const REFLEXIVE_PRONOUN_WORDS = new Set(['me', 'te', 'se', 'nos', 'os'])

/** Pronoun suffixes for imperative, ordered longest-first to avoid partial matches */
const PRONOUN_SUFFIXES = ['nos', 'me', 'te', 'se', 'os']

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

/** Check if a conjugated form already has a reflexive pronoun */
function formAlreadyHasPronoun(form: string, tenseId: string): boolean {
  if (tenseId === 'imperative') {
    return PRONOUN_SUFFIXES.some(p => form.endsWith(p))
  }
  const firstWord = form.split(' ')[0].toLowerCase()
  return REFLEXIVE_PRONOUN_WORDS.has(firstWord)
}

/**
 * Add reflexive pronouns to a conjugated form.
 * Does not check if the verb is reflexive — caller decides when to use this.
 * Safe to call on forms that already have pronouns (will not double-add).
 */
export function addReflexivePronouns(
  form: string,
  person: string,
  tenseId: string
): string {
  if (formAlreadyHasPronoun(form, tenseId)) return form

  const pronoun = getReflexivePronoun(person)

  // Affirmative imperative: pronoun attached to end
  if (tenseId === 'imperative') {
    return `${form}${pronoun}`
  }

  // Compound tense: pronoun before auxiliary
  const words = form.split(' ')
  if (words.length >= 2 && HABER_FORMS.includes(words[0].toLowerCase())) {
    return `${pronoun} ${form}`
  }

  // Simple tense: pronoun before verb
  return `${pronoun} ${form}`
}

/**
 * Strip reflexive pronouns from a conjugated form.
 * For simple/compound tenses, removes the leading pronoun word.
 * For imperative, strips the trailing pronoun suffix and removes
 * any accent that was added for the attachment.
 */
export function stripReflexivePronoun(form: string, tenseId: string): string {
  if (tenseId === 'imperative') {
    for (const suffix of PRONOUN_SUFFIXES) {
      if (form.endsWith(suffix)) {
        let stripped = form.slice(0, -suffix.length)
        // Remove accent that was added when pronoun was attached
        // e.g. "quéjate" → "quéja" → "queja"
        stripped = stripped.normalize('NFD').replace(/\u0301/g, '').normalize('NFC')
        return stripped
      }
    }
    return form
  }

  // Simple/compound: pronoun is the first word
  const words = form.split(' ')
  if (words.length >= 2 && REFLEXIVE_PRONOUN_WORDS.has(words[0].toLowerCase())) {
    return words.slice(1).join(' ')
  }

  return form
}

/**
 * Format a conjugated form with the correct reflexive pronoun placement.
 * Only applies to verbs whose infinitive ends in "-se".
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
  return addReflexivePronouns(form, person, tenseId)
}
