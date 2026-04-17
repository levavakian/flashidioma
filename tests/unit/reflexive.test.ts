import { describe, it, expect } from 'vitest'
import {
  isReflexiveVerb,
  getBaseInfinitive,
  getReflexivePronoun,
  addReflexivePronouns,
  stripReflexivePronoun,
  formatReflexiveForm,
  reflexifyVerbData,
} from '../../src/services/reflexive'
import type { VerbData } from '../../src/types'

describe('isReflexiveVerb', () => {
  it('detects -se infinitives', () => {
    expect(isReflexiveVerb('mudarse')).toBe(true)
    expect(isReflexiveVerb('levantarse')).toBe(true)
    expect(isReflexiveVerb('irse')).toBe(true)
  })

  it('returns false for non-reflexive infinitives', () => {
    expect(isReflexiveVerb('mudar')).toBe(false)
    expect(isReflexiveVerb('comer')).toBe(false)
    expect(isReflexiveVerb('se')).toBe(false)
  })
})

describe('getBaseInfinitive', () => {
  it('strips -se from reflexive infinitives', () => {
    expect(getBaseInfinitive('mudarse')).toBe('mudar')
    expect(getBaseInfinitive('vestirse')).toBe('vestir')
    expect(getBaseInfinitive('irse')).toBe('ir')
  })

  it('returns non-reflexive infinitives unchanged', () => {
    expect(getBaseInfinitive('mudar')).toBe('mudar')
    expect(getBaseInfinitive('comer')).toBe('comer')
  })
})

describe('getReflexivePronoun', () => {
  it('maps each person to its reflexive pronoun', () => {
    expect(getReflexivePronoun('yo')).toBe('me')
    expect(getReflexivePronoun('tú')).toBe('te')
    expect(getReflexivePronoun('él/ella/usted')).toBe('se')
    expect(getReflexivePronoun('usted')).toBe('se')
    expect(getReflexivePronoun('nosotros/as')).toBe('nos')
    expect(getReflexivePronoun('vosotros/as')).toBe('os')
    expect(getReflexivePronoun('ellos/ellas/ustedes')).toBe('se')
    expect(getReflexivePronoun('ustedes')).toBe('se')
  })
})

describe('addReflexivePronouns — simple tenses', () => {
  it('places pronoun before the verb', () => {
    expect(addReflexivePronouns('mudo', 'yo', 'present')).toBe('me mudo')
    expect(addReflexivePronouns('mudas', 'tú', 'present')).toBe('te mudas')
    expect(addReflexivePronouns('mudamos', 'nosotros/as', 'present')).toBe('nos mudamos')
  })
})

describe('addReflexivePronouns — compound, progressive, modal', () => {
  it('places pronoun before the auxiliary', () => {
    expect(addReflexivePronouns('he mudado', 'yo', 'present-perfect')).toBe('me he mudado')
    expect(addReflexivePronouns('estoy mudando', 'yo', 'present-progressive')).toBe('me estoy mudando')
    expect(addReflexivePronouns('puedo mudar', 'yo', 'poder-present')).toBe('me puedo mudar')
    expect(addReflexivePronouns('debo mudar', 'yo', 'deber-present')).toBe('me debo mudar')
  })
})

describe('addReflexivePronouns — affirmative imperative', () => {
  it('attaches pronoun to tú with stress accent on multi-syllable forms', () => {
    expect(addReflexivePronouns('muda', 'tú', 'imperative')).toBe('múdate')
    expect(addReflexivePronouns('levanta', 'tú', 'imperative')).toBe('levántate')
    expect(addReflexivePronouns('come', 'tú', 'imperative')).toBe('cómete')
  })

  it('does not add an accent for single-syllable tú forms', () => {
    expect(addReflexivePronouns('ve', 'tú', 'imperative')).toBe('vete')
    expect(addReflexivePronouns('da', 'tú', 'imperative')).toBe('date')
    expect(addReflexivePronouns('pon', 'tú', 'imperative')).toBe('ponte')
    expect(addReflexivePronouns('ten', 'tú', 'imperative')).toBe('tente')
  })

  it('attaches pronoun to usted (subjunctive form)', () => {
    expect(addReflexivePronouns('mude', 'usted', 'imperative')).toBe('múdese')
    expect(addReflexivePronouns('queje', 'usted', 'imperative')).toBe('quéjese')
  })

  it('attaches pronoun to ustedes', () => {
    expect(addReflexivePronouns('muden', 'ustedes', 'imperative')).toBe('múdense')
    expect(addReflexivePronouns('quejen', 'ustedes', 'imperative')).toBe('quéjense')
  })

  it('drops the -s of nosotros and adds an accent', () => {
    expect(addReflexivePronouns('mudemos', 'nosotros/as', 'imperative')).toBe('mudémonos')
    expect(addReflexivePronouns('quejemos', 'nosotros/as', 'imperative')).toBe('quejémonos')
    expect(addReflexivePronouns('movamos', 'nosotros/as', 'imperative')).toBe('movámonos')
  })

  it('drops the -d of vosotros (no accent for -ar, accent on -i for -ir)', () => {
    expect(addReflexivePronouns('mudad', 'vosotros/as', 'imperative')).toBe('mudaos')
    expect(addReflexivePronouns('quejad', 'vosotros/as', 'imperative')).toBe('quejaos')
    expect(addReflexivePronouns('comed', 'vosotros/as', 'imperative')).toBe('comeos')
    expect(addReflexivePronouns('vestid', 'vosotros/as', 'imperative')).toBe('vestíos')
    expect(addReflexivePronouns('partid', 'vosotros/as', 'imperative')).toBe('partíos')
  })

  it('honors hiatus rules when two strong vowels meet', () => {
    // caer/traer/leer/creer/ver: stem ends in a strong vowel and the clitic
    // begins with one too, so the vowel pair is a hiatus (two syllables).
    // The originally stressed syllable shifts back by 2 syllables and needs
    // a written accent on its strong vowel.
    expect(addReflexivePronouns('cae', 'tú', 'imperative')).toBe('cáete')
    expect(addReflexivePronouns('trae', 'tú', 'imperative')).toBe('tráete')
    expect(addReflexivePronouns('cree', 'tú', 'imperative')).toBe('créete')
    expect(addReflexivePronouns('lee', 'tú', 'imperative')).toBe('léete')
    expect(addReflexivePronouns('vea', 'usted', 'imperative')).toBe('véase')
    expect(addReflexivePronouns('vean', 'ustedes', 'imperative')).toBe('véanse')
    expect(addReflexivePronouns('crea', 'usted', 'imperative')).toBe('créase')
    expect(addReflexivePronouns('lea', 'usted', 'imperative')).toBe('léase')
  })
})

describe('formatReflexiveForm', () => {
  it('is a no-op for non-reflexive infinitives', () => {
    expect(formatReflexiveForm('mudo', 'yo', 'mudar', 'present')).toBe('mudo')
    expect(formatReflexiveForm('come', 'tú', 'comer', 'imperative')).toBe('come')
  })

  it('adds pronouns for reflexive infinitives', () => {
    expect(formatReflexiveForm('mudo', 'yo', 'mudarse', 'present')).toBe('me mudo')
    expect(formatReflexiveForm('muda', 'tú', 'mudarse', 'imperative')).toBe('múdate')
  })

  it('is idempotent — does not double-add pronouns', () => {
    expect(formatReflexiveForm('me mudo', 'yo', 'mudarse', 'present')).toBe('me mudo')
    expect(formatReflexiveForm('múdate', 'tú', 'mudarse', 'imperative')).toBe('múdate')
    expect(formatReflexiveForm('quejémonos', 'nosotros/as', 'quejarse', 'imperative')).toBe('quejémonos')
  })
})

describe('stripReflexivePronoun', () => {
  it('strips leading pronoun for simple/compound/progressive tenses', () => {
    expect(stripReflexivePronoun('me mudo', 'present')).toBe('mudo')
    expect(stripReflexivePronoun('me he mudado', 'present-perfect')).toBe('he mudado')
    expect(stripReflexivePronoun('me estoy mudando', 'present-progressive')).toBe('estoy mudando')
  })

  it('strips imperative clitic and undoes elisions/accents', () => {
    expect(stripReflexivePronoun('múdate', 'imperative')).toBe('muda')
    expect(stripReflexivePronoun('quéjese', 'imperative')).toBe('queje')
    expect(stripReflexivePronoun('quejémonos', 'imperative')).toBe('quejemos')
    expect(stripReflexivePronoun('quejaos', 'imperative')).toBe('quejad')
    expect(stripReflexivePronoun('vestíos', 'imperative')).toBe('vestid')
    expect(stripReflexivePronoun('vete', 'imperative')).toBe('ve')
  })
})

describe('reflexifyVerbData', () => {
  const baseVerbData: VerbData = {
    infinitive: 'mudar',
    language: 'spanish',
    tenses: [
      {
        tenseId: 'present',
        tenseName: 'Present',
        description: 'Present',
        conjugations: [
          { person: 'yo', form: 'mudo', miniTranslation: '' },
          { person: 'tú', form: 'mudas', miniTranslation: '' },
          { person: 'él/ella/usted', form: 'muda', miniTranslation: '' },
          { person: 'nosotros/as', form: 'mudamos', miniTranslation: '' },
          { person: 'vosotros/as', form: 'mudáis', miniTranslation: '' },
          { person: 'ellos/ellas/ustedes', form: 'mudan', miniTranslation: '' },
        ],
      },
      {
        tenseId: 'imperative',
        tenseName: 'Imperative',
        description: 'Commands',
        conjugations: [
          { person: 'tú', form: 'muda', miniTranslation: '' },
          { person: 'usted', form: 'mude', miniTranslation: '' },
          { person: 'nosotros/as', form: 'mudemos', miniTranslation: '' },
          { person: 'vosotros/as', form: 'mudad', miniTranslation: '' },
          { person: 'ustedes', form: 'muden', miniTranslation: '' },
        ],
      },
    ],
  }

  it('synthesizes a reflexive table from a non-reflexive base', () => {
    const result = reflexifyVerbData(baseVerbData)
    expect(result.infinitive).toBe('mudarse')
    const present = result.tenses.find((t) => t.tenseId === 'present')!
    expect(present.conjugations.map((c) => c.form)).toEqual([
      'me mudo',
      'te mudas',
      'se muda',
      'nos mudamos',
      'os mudáis',
      'se mudan',
    ])
    const imp = result.tenses.find((t) => t.tenseId === 'imperative')!
    expect(imp.conjugations.map((c) => c.form)).toEqual([
      'múdate', 'múdese', 'mudémonos', 'mudaos', 'múdense',
    ])
  })

  it('preserves tense metadata', () => {
    const result = reflexifyVerbData(baseVerbData)
    const present = result.tenses.find((t) => t.tenseId === 'present')!
    expect(present.tenseName).toBe('Present')
    expect(present.description).toBe('Present')
  })
})
