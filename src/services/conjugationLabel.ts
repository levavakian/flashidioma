/**
 * Helpers for the English label on auto-added conjugation cards.
 * Labels look like "we meet [to meet (nosotros/as present)]".
 */

/**
 * Extract the English infinitive from a label's bracket annotation,
 * e.g. "you commented [to comment (tú preterite)]" → "to comment".
 * Returns null when the text has no bracket annotation.
 */
export function extractBracketedInfinitive(text: string): string | null {
  const match = text.match(/\[\s*(to [^\][()]+?)\s*\(/)
  return match ? match[1] : null
}

/**
 * Rebuild a label whose bracket annotations were nested by older app
 * versions, e.g.
 *   "you commented [to comment (tú preterite)] [to you commented [to comment (tú preterite)] (ellos/ellas/ustedes present subjunctive)]"
 * becomes
 *   "to comment [to comment (ellos/ellas/ustedes present subjunctive)]"
 * keeping only the person/tense the card's Spanish form is actually in.
 * Returns null when the label is not nested.
 */
export function repairNestedConjugationLabel(text: string): string | null {
  const bracketCount = (text.match(/\[/g) ?? []).length
  if (bracketCount < 2) return null

  const infinitive = extractBracketedInfinitive(text)
  const personTense = text.match(/\(([^()]+)\)\]$/)
  if (!infinitive || !personTense) return null

  return `${infinitive} [${infinitive} (${personTense[1]})]`
}
