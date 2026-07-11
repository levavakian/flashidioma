import { describe, it, expect } from 'vitest'
import {
  extractBracketedInfinitive,
  repairNestedConjugationLabel,
} from '../../src/services/conjugationLabel'

const NESTED_LABEL =
  'you commented [to comment (tú preterite)] [to you commented [to comment (tú preterite)] (ellos/ellas/ustedes present subjunctive)]'

describe('extractBracketedInfinitive', () => {
  it('extracts the infinitive from a normal label', () => {
    expect(extractBracketedInfinitive('we meet [to meet (nosotros/as present)]')).toBe('to meet')
  })

  it('extracts the innermost infinitive from a nested label', () => {
    expect(extractBracketedInfinitive(NESTED_LABEL)).toBe('to comment')
  })

  it('returns null for text without a bracket annotation', () => {
    expect(extractBracketedInfinitive('to eat')).toBeNull()
    expect(extractBracketedInfinitive('comentar')).toBeNull()
  })
})

describe('repairNestedConjugationLabel', () => {
  it('rebuilds a nested label with only the latest person/tense', () => {
    expect(repairNestedConjugationLabel(NESTED_LABEL)).toBe(
      'to comment [to comment (ellos/ellas/ustedes present subjunctive)]'
    )
  })

  it('repairs doubly nested labels', () => {
    const doublyNested = `${NESTED_LABEL} [to ${NESTED_LABEL} (yo imperfect)]`
    expect(repairNestedConjugationLabel(doublyNested)).toBe('to comment [to comment (yo imperfect)]')
  })

  it('leaves normal labels untouched', () => {
    expect(repairNestedConjugationLabel('we meet [to meet (nosotros/as present)]')).toBeNull()
  })

  it('leaves plain text untouched', () => {
    expect(repairNestedConjugationLabel('to eat')).toBeNull()
  })
})
