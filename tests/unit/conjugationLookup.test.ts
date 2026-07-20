import { describe, it, expect } from 'vitest'
import { lookupConjugation, hasConjugation } from '../../src/services/conjugationLookup'

describe('Static conjugation DB lookup', () => {
  it('returns conjugation data for known verbs', async () => {
    const result = await lookupConjugation('hablar')
    expect(result).not.toBeNull()
    expect(result!.infinitive).toBe('hablar')
    expect(result!.language).toBe('spanish')
    expect(result!.tenses.length).toBeGreaterThan(0)

    const present = result!.tenses.find((t) => t.tenseId === 'present')!
    expect(present.conjugations[0].form).toBe('hablo')
    expect(present.conjugations[0].person).toBe('yo')
    expect(present.conjugations[0].miniTranslation).toBe('')
  })

  it('returns null for unknown verbs', async () => {
    const result = await lookupConjugation('xyzverbar')
    expect(result).toBeNull()
  })

  it('hasConjugation returns true for known verbs', async () => {
    expect(await hasConjugation('hablar')).toBe(true)
    expect(await hasConjugation('ser')).toBe(true)
    expect(await hasConjugation('comer')).toBe(true)
  })

  it('hasConjugation returns false for unknown verbs', async () => {
    expect(await hasConjugation('xyzverbar')).toBe(false)
    expect(await hasConjugation('notaverb')).toBe(false)
  })

  it('returns correct data for irregular verbs', async () => {
    const ser = await lookupConjugation('ser')
    expect(ser).not.toBeNull()
    expect(ser!.infinitive).toBe('ser')

    const present = ser!.tenses.find((t) => t.tenseId === 'present')!
    const forms = present.conjugations.map((c) => c.form)
    expect(forms).toEqual(['soy', 'eres', 'es', 'somos', 'sois', 'son'])
  })

  it('returns correct data for fallback-only irregular verbs', async () => {
    const haber = await lookupConjugation('haber')
    expect(haber).not.toBeNull()
    expect(haber!.tenses.find((t) => t.tenseId === 'present')!.conjugations.map((c) => c.form)).toEqual([
      'he', 'has', 'ha', 'hemos', 'habéis', 'han',
    ])

    const asir = await lookupConjugation('asir')
    expect(asir).not.toBeNull()
    expect(asir!.tenses.find((t) => t.tenseId === 'present')!.conjugations.map((c) => c.form)).toEqual([
      'asgo', 'ases', 'ase', 'asimos', 'asís', 'asen',
    ])

    const soltar = await lookupConjugation('soltar')
    expect(soltar).not.toBeNull()
    expect(soltar!.tenses.find((t) => t.tenseId === 'present')!.conjugations.map((c) => c.form)).toEqual([
      'suelto', 'sueltas', 'suelta', 'soltamos', 'soltáis', 'sueltan',
    ])
  })

  it('returns all 21 tenses for a verb', async () => {
    const result = await lookupConjugation('hablar')
    expect(result!.tenses).toHaveLength(21)

    const tenseIds = result!.tenses.map((t) => t.tenseId)
    expect(tenseIds).toContain('present')
    expect(tenseIds).toContain('preterite')
    expect(tenseIds).toContain('imperfect')
    expect(tenseIds).toContain('future')
    expect(tenseIds).toContain('conditional')
    expect(tenseIds).toContain('present-subjunctive')
    expect(tenseIds).toContain('imperfect-subjunctive')
    expect(tenseIds).toContain('perfect-subjunctive')
    expect(tenseIds).toContain('pluperfect-subjunctive')
    expect(tenseIds).toContain('imperative')
    expect(tenseIds).toContain('negative-imperative')
    expect(tenseIds).toContain('present-perfect')
    expect(tenseIds).toContain('pluperfect')
    expect(tenseIds).toContain('future-perfect')
    expect(tenseIds).toContain('conditional-perfect')
    expect(tenseIds).toContain('present-progressive')
    expect(tenseIds).toContain('preterite-progressive')
    expect(tenseIds).toContain('imperfect-progressive')
    expect(tenseIds).toContain('future-progressive')
    expect(tenseIds).toContain('poder-present')
    expect(tenseIds).toContain('deber-present')
  })

  it('includes negative imperative forms', async () => {
    const result = await lookupConjugation('hablar')
    const negative = result!.tenses.find((t) => t.tenseId === 'negative-imperative')!
    expect(negative.conjugations.map((c) => c.person)).toEqual([
      'tú', 'usted', 'nosotros/as', 'vosotros/as', 'ustedes',
    ])
    expect(negative.conjugations.map((c) => c.form)).toEqual([
      'no hables', 'no hable', 'no hablemos', 'no habléis', 'no hablen',
    ])
  })

  it('compound tenses include haber forms', async () => {
    const result = await lookupConjugation('hablar')
    const pp = result!.tenses.find((t) => t.tenseId === 'present-perfect')!
    expect(pp.conjugations[0].form).toBe('he hablado')
    expect(pp.conjugations[5].form).toBe('han hablado')
  })

  it('includes perfect and pluperfect subjunctive forms', async () => {
    const result = await lookupConjugation('hablar')
    const perfSub = result!.tenses.find((t) => t.tenseId === 'perfect-subjunctive')!
    expect(perfSub.conjugations.map((c) => c.form)).toEqual([
      'haya hablado', 'hayas hablado', 'haya hablado',
      'hayamos hablado', 'hayáis hablado', 'hayan hablado',
    ])

    const plupSub = result!.tenses.find((t) => t.tenseId === 'pluperfect-subjunctive')!
    expect(plupSub.conjugations.map((c) => c.form)).toEqual([
      'hubiera hablado', 'hubieras hablado', 'hubiera hablado',
      'hubiéramos hablado', 'hubierais hablado', 'hubieran hablado',
    ])
  })

  describe('reflexive verb support', () => {
    it('falls back to base infinitive for -se verbs not in DB', async () => {
      // mudarse is not in the DB; mudar is. lookupConjugation should
      // synthesize the reflexive table from mudar.
      const result = await lookupConjugation('mudarse')
      expect(result).not.toBeNull()
      expect(result!.infinitive).toBe('mudarse')
      const present = result!.tenses.find((t) => t.tenseId === 'present')!
      expect(present.conjugations.map((c) => c.form)).toEqual([
        'me mudo', 'te mudas', 'se muda', 'nos mudamos', 'os mudáis', 'se mudan',
      ])
    })

    it('synthesized reflexive imperative includes correct stress accents', async () => {
      const result = await lookupConjugation('mudarse')
      const imp = result!.tenses.find((t) => t.tenseId === 'imperative')!
      expect(imp.conjugations.map((c) => c.form)).toEqual([
        'múdate', 'múdese', 'mudémonos', 'mudaos', 'múdense',
      ])
    })

    it('synthesized reflexive negative imperative places pronoun after "no"', async () => {
      const result = await lookupConjugation('mudarse')
      const neg = result!.tenses.find((t) => t.tenseId === 'negative-imperative')!
      expect(neg.conjugations.map((c) => c.form)).toEqual([
        'no te mudes', 'no se mude', 'no nos mudemos', 'no os mudéis', 'no se muden',
      ])
    })

    it('synthesized reflexive perfect subjunctive places pronoun before haber', async () => {
      const result = await lookupConjugation('mudarse')
      const perfSub = result!.tenses.find((t) => t.tenseId === 'perfect-subjunctive')!
      expect(perfSub.conjugations[0].form).toBe('me haya mudado')
      const plupSub = result!.tenses.find((t) => t.tenseId === 'pluperfect-subjunctive')!
      expect(plupSub.conjugations[0].form).toBe('me hubiera mudado')
    })

    it('synthesized reflexive progressive places pronoun before estar', async () => {
      const result = await lookupConjugation('mudarse')
      const prog = result!.tenses.find((t) => t.tenseId === 'present-progressive')!
      expect(prog.conjugations.map((c) => c.form)).toEqual([
        'me estoy mudando',
        'te estás mudando',
        'se está mudando',
        'nos estamos mudando',
        'os estáis mudando',
        'se están mudando',
      ])
    })

    it('reflexive verbs already in the DB use stored forms', async () => {
      const result = await lookupConjugation('quejarse')
      expect(result).not.toBeNull()
      const present = result!.tenses.find((t) => t.tenseId === 'present')!
      expect(present.conjugations[0].form).toBe('me quejo')
      const prog = result!.tenses.find((t) => t.tenseId === 'present-progressive')!
      // Bug fix: progressive used to be "estoy quejándose" — now reflexive
      // pronoun is correctly placed before estar with a clean gerund.
      expect(prog.conjugations[0].form).toBe('me estoy quejando')
      const pod = result!.tenses.find((t) => t.tenseId === 'poder-present')!
      expect(pod.conjugations[0].form).toBe('me puedo quejar')
    })

    it('hasConjugation returns true for reflexive verbs whose base is in the DB', async () => {
      expect(await hasConjugation('mudarse')).toBe(true)
      expect(await hasConjugation('comerse')).toBe(true)
      expect(await hasConjugation('xyzverbarse')).toBe(false)
    })
  })

  it('includes preterite progressive forms in static data', async () => {
    const result = await lookupConjugation('hablar')
    const preteriteProgressive = result!.tenses.find((t) => t.tenseId === 'preterite-progressive')!

    expect(preteriteProgressive.conjugations.map((c) => c.form)).toEqual([
      'estuve hablando',
      'estuviste hablando',
      'estuvo hablando',
      'estuvimos hablando',
      'estuvisteis hablando',
      'estuvieron hablando',
    ])
  })
})
