import { describe, it, expect } from 'vitest'
import { conjugateVerb, isIrregular } from '../../scripts/spanish-conjugator'

describe('Spanish conjugation engine', () => {
  describe('regular -ar verbs', () => {
    it('conjugates hablar correctly in all simple tenses', () => {
      const result = conjugateVerb('hablar')!
      expect(result.infinitive).toBe('hablar')

      const present = result.tenses.find((t) => t.tenseId === 'present')!
      const forms = present.conjugations.map((c) => c.form)
      expect(forms).toEqual(['hablo', 'hablas', 'habla', 'hablamos', 'habláis', 'hablan'])

      const preterite = result.tenses.find((t) => t.tenseId === 'preterite')!
      expect(preterite.conjugations.map((c) => c.form)).toEqual([
        'hablé', 'hablaste', 'habló', 'hablamos', 'hablasteis', 'hablaron',
      ])

      const imperfect = result.tenses.find((t) => t.tenseId === 'imperfect')!
      expect(imperfect.conjugations.map((c) => c.form)).toEqual([
        'hablaba', 'hablabas', 'hablaba', 'hablábamos', 'hablabais', 'hablaban',
      ])

      const future = result.tenses.find((t) => t.tenseId === 'future')!
      expect(future.conjugations.map((c) => c.form)).toEqual([
        'hablaré', 'hablarás', 'hablará', 'hablaremos', 'hablaréis', 'hablarán',
      ])

      const conditional = result.tenses.find((t) => t.tenseId === 'conditional')!
      expect(conditional.conjugations.map((c) => c.form)).toEqual([
        'hablaría', 'hablarías', 'hablaría', 'hablaríamos', 'hablaríais', 'hablarían',
      ])
    })

    it('conjugates regular -ar verb subjunctive forms', () => {
      const result = conjugateVerb('hablar')!
      const presSub = result.tenses.find((t) => t.tenseId === 'present-subjunctive')!
      expect(presSub.conjugations.map((c) => c.form)).toEqual([
        'hable', 'hables', 'hable', 'hablemos', 'habléis', 'hablen',
      ])

      const impSub = result.tenses.find((t) => t.tenseId === 'imperfect-subjunctive')!
      expect(impSub.conjugations.map((c) => c.form)).toEqual([
        'hablara', 'hablaras', 'hablara', 'habláramos', 'hablarais', 'hablaran',
      ])
    })
  })

  describe('regular -er verbs', () => {
    it('conjugates comer correctly in present and preterite', () => {
      const result = conjugateVerb('comer')!
      expect(result.infinitive).toBe('comer')

      const present = result.tenses.find((t) => t.tenseId === 'present')!
      expect(present.conjugations.map((c) => c.form)).toEqual([
        'como', 'comes', 'come', 'comemos', 'coméis', 'comen',
      ])

      const preterite = result.tenses.find((t) => t.tenseId === 'preterite')!
      expect(preterite.conjugations.map((c) => c.form)).toEqual([
        'comí', 'comiste', 'comió', 'comimos', 'comisteis', 'comieron',
      ])
    })
  })

  describe('regular -ir verbs', () => {
    it('conjugates vivir correctly in present', () => {
      const result = conjugateVerb('vivir')!
      const present = result.tenses.find((t) => t.tenseId === 'present')!
      expect(present.conjugations.map((c) => c.form)).toEqual([
        'vivo', 'vives', 'vive', 'vivimos', 'vivís', 'viven',
      ])
    })
  })

  describe('irregular verbs', () => {
    it('conjugates ser correctly (highly irregular)', () => {
      const result = conjugateVerb('ser')!
      expect(result.infinitive).toBe('ser')
      expect(isIrregular('ser')).toBe(true)

      const present = result.tenses.find((t) => t.tenseId === 'present')!
      expect(present.conjugations.map((c) => c.form)).toEqual([
        'soy', 'eres', 'es', 'somos', 'sois', 'son',
      ])

      const preterite = result.tenses.find((t) => t.tenseId === 'preterite')!
      expect(preterite.conjugations.map((c) => c.form)).toEqual([
        'fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron',
      ])

      const imperfect = result.tenses.find((t) => t.tenseId === 'imperfect')!
      expect(imperfect.conjugations.map((c) => c.form)).toEqual([
        'era', 'eras', 'era', 'éramos', 'erais', 'eran',
      ])
    })

    it('conjugates ir correctly (highly irregular)', () => {
      const result = conjugateVerb('ir')!
      expect(isIrregular('ir')).toBe(true)

      const present = result.tenses.find((t) => t.tenseId === 'present')!
      expect(present.conjugations.map((c) => c.form)).toEqual([
        'voy', 'vas', 'va', 'vamos', 'vais', 'van',
      ])

      const imperfect = result.tenses.find((t) => t.tenseId === 'imperfect')!
      expect(imperfect.conjugations.map((c) => c.form)).toEqual([
        'iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban',
      ])
    })

    it('conjugates tener with irregular stem in future/conditional', () => {
      const result = conjugateVerb('tener')!
      expect(isIrregular('tener')).toBe(true)

      const future = result.tenses.find((t) => t.tenseId === 'future')!
      expect(future.conjugations[0].form).toBe('tendré')
      expect(future.conjugations[1].form).toBe('tendrás')

      const conditional = result.tenses.find((t) => t.tenseId === 'conditional')!
      expect(conditional.conjugations[0].form).toBe('tendría')
    })

    it('conjugates hacer with irregular participle', () => {
      const result = conjugateVerb('hacer')!
      const pp = result.tenses.find((t) => t.tenseId === 'present-perfect')!
      expect(pp.conjugations[0].form).toBe('he hecho')
    })
  })

  describe('compound tenses', () => {
    it('generates compound tenses with haber + participle', () => {
      const result = conjugateVerb('hablar')!

      const pp = result.tenses.find((t) => t.tenseId === 'present-perfect')!
      expect(pp.conjugations.map((c) => c.form)).toEqual([
        'he hablado', 'has hablado', 'ha hablado',
        'hemos hablado', 'habéis hablado', 'han hablado',
      ])

      const plup = result.tenses.find((t) => t.tenseId === 'pluperfect')!
      expect(plup.conjugations[0].form).toBe('había hablado')

      const futPerf = result.tenses.find((t) => t.tenseId === 'future-perfect')!
      expect(futPerf.conjugations[0].form).toBe('habré hablado')

      const condPerf = result.tenses.find((t) => t.tenseId === 'conditional-perfect')!
      expect(condPerf.conjugations[0].form).toBe('habría hablado')
    })

    it('uses irregular participles in compound tenses', () => {
      const result = conjugateVerb('escribir')!
      const pp = result.tenses.find((t) => t.tenseId === 'present-perfect')!
      expect(pp.conjugations[0].form).toBe('he escrito')
    })
  })

  describe('tense metadata', () => {
    it('includes all 12 tenses', () => {
      const result = conjugateVerb('hablar')!
      expect(result.tenses).toHaveLength(12)

      const tenseIds = result.tenses.map((t) => t.tenseId)
      expect(tenseIds).toEqual([
        'present', 'preterite', 'imperfect', 'future', 'conditional',
        'present-subjunctive', 'imperfect-subjunctive', 'imperative',
        'present-perfect', 'pluperfect', 'future-perfect', 'conditional-perfect',
      ])
    })

    it('includes tense names and descriptions', () => {
      const result = conjugateVerb('hablar')!
      const present = result.tenses.find((t) => t.tenseId === 'present')!
      expect(present.tenseName).toBe('Present')
      expect(present.description).toContain('Actions happening now')
    })

    it('imperative has 5 persons instead of 6', () => {
      const result = conjugateVerb('hablar')!
      const imperative = result.tenses.find((t) => t.tenseId === 'imperative')!
      expect(imperative.conjugations).toHaveLength(5)
      expect(imperative.conjugations.map((c) => c.person)).toEqual([
        'tú', 'usted', 'nosotros/as', 'vosotros/as', 'ustedes',
      ])
    })
  })

  describe('edge cases', () => {
    it('returns null for non-verb words', () => {
      expect(conjugateVerb('casa')).toBeNull()
      expect(conjugateVerb('bien')).toBeNull()
      expect(conjugateVerb('xyz')).toBeNull()
    })

    it('regular verbs are not marked irregular', () => {
      expect(isIrregular('hablar')).toBe(false)
      expect(isIrregular('comer')).toBe(false)
      expect(isIrregular('vivir')).toBe(false)
    })
  })
})
