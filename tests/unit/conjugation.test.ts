import { describe, it, expect } from 'vitest'
import { conjugateVerb } from '../../scripts/spanish-conjugator'

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

      const perfSub = result.tenses.find((t) => t.tenseId === 'perfect-subjunctive')!
      expect(perfSub.conjugations.map((c) => c.form)).toEqual([
        'haya hablado', 'hayas hablado', 'haya hablado',
        'hayamos hablado', 'hayáis hablado', 'hayan hablado',
      ])

      const plupSub = result.tenses.find((t) => t.tenseId === 'pluperfect-subjunctive')!
      expect(plupSub.conjugations.map((c) => c.form)).toEqual([
        'hubiera hablado', 'hubieras hablado', 'hubiera hablado',
        'hubiéramos hablado', 'hubierais hablado', 'hubieran hablado',
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

  describe('irregular fallback coverage', () => {
    it('conjugates haber correctly when it is missing from Jehle', () => {
      const result = conjugateVerb('haber')!

      const present = result.tenses.find((t) => t.tenseId === 'present')!
      expect(present.conjugations.map((c) => c.form)).toEqual([
        'he', 'has', 'ha', 'hemos', 'habéis', 'han',
      ])

      const future = result.tenses.find((t) => t.tenseId === 'future')!
      expect(future.conjugations.map((c) => c.form)).toEqual([
        'habré', 'habrás', 'habrá', 'habremos', 'habréis', 'habrán',
      ])

      const impSub = result.tenses.find((t) => t.tenseId === 'imperfect-subjunctive')!
      expect(impSub.conjugations.map((c) => c.form)).toEqual([
        'hubiera', 'hubieras', 'hubiera', 'hubiéramos', 'hubierais', 'hubieran',
      ])
    })

    it('conjugates irregular verbs that previously fell through to regular rules', () => {
      const asir = conjugateVerb('asir')!
      expect(asir.tenses.find((t) => t.tenseId === 'present')!.conjugations.map((c) => c.form)).toEqual([
        'asgo', 'ases', 'ase', 'asimos', 'asís', 'asen',
      ])

      const soltar = conjugateVerb('soltar')!
      expect(soltar.tenses.find((t) => t.tenseId === 'present')!.conjugations.map((c) => c.form)).toEqual([
        'suelto', 'sueltas', 'suelta', 'soltamos', 'soltáis', 'sueltan',
      ])

      const sostener = conjugateVerb('sostener')!
      expect(sostener.tenses.find((t) => t.tenseId === 'present')!.conjugations.map((c) => c.form)).toEqual([
        'sostengo', 'sostienes', 'sostiene', 'sostenemos', 'sostenéis', 'sostienen',
      ])
      expect(sostener.tenses.find((t) => t.tenseId === 'future')!.conjugations[0].form).toBe('sostendré')
    })

    it('conjugates reflexive verbs instead of dropping them', () => {
      const result = conjugateVerb('aburrirse')!

      const present = result.tenses.find((t) => t.tenseId === 'present')!
      expect(present.conjugations.map((c) => c.form)).toEqual([
        'me aburro',
        'te aburres',
        'se aburre',
        'nos aburrimos',
        'os aburrís',
        'se aburren',
      ])

      const pp = result.tenses.find((t) => t.tenseId === 'present-perfect')!
      expect(pp.conjugations[0].form).toBe('me he aburrido')
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

      const perfSub = result.tenses.find((t) => t.tenseId === 'perfect-subjunctive')!
      expect(perfSub.conjugations[0].form).toBe('haya escrito')

      const plupSub = result.tenses.find((t) => t.tenseId === 'pluperfect-subjunctive')!
      expect(plupSub.conjugations[0].form).toBe('hubiera escrito')
    })

    it('places reflexive pronouns before the subjunctive auxiliary', () => {
      const result = conjugateVerb('quejarse')!
      const perfSub = result.tenses.find((t) => t.tenseId === 'perfect-subjunctive')!
      expect(perfSub.conjugations.map((c) => c.form)).toEqual([
        'me haya quejado', 'te hayas quejado', 'se haya quejado',
        'nos hayamos quejado', 'os hayáis quejado', 'se hayan quejado',
      ])

      const plupSub = result.tenses.find((t) => t.tenseId === 'pluperfect-subjunctive')!
      expect(plupSub.conjugations[0].form).toBe('me hubiera quejado')
    })
  })

  describe('tense metadata', () => {
    it('includes all 21 tenses', () => {
      const result = conjugateVerb('hablar')!
      expect(result.tenses).toHaveLength(21)

      const tenseIds = result.tenses.map((t) => t.tenseId)
      expect(tenseIds).toEqual([
        'present', 'preterite', 'imperfect', 'future', 'conditional',
        'present-subjunctive', 'imperfect-subjunctive', 'perfect-subjunctive', 'pluperfect-subjunctive',
        'imperative', 'negative-imperative',
        'present-perfect', 'pluperfect', 'future-perfect', 'conditional-perfect',
        'present-progressive', 'preterite-progressive', 'imperfect-progressive', 'future-progressive',
        'poder-present', 'deber-present',
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

    it('negative imperative is "no" + present subjunctive for the 5 command persons', () => {
      const result = conjugateVerb('hablar')!
      const negative = result.tenses.find((t) => t.tenseId === 'negative-imperative')!
      expect(negative.conjugations.map((c) => c.person)).toEqual([
        'tú', 'usted', 'nosotros/as', 'vosotros/as', 'ustedes',
      ])
      expect(negative.conjugations.map((c) => c.form)).toEqual([
        'no hables', 'no hable', 'no hablemos', 'no habléis', 'no hablen',
      ])
    })

    it('negative imperative reflects irregular present subjunctive stems', () => {
      const tener = conjugateVerb('tener')!
      const negTener = tener.tenses.find((t) => t.tenseId === 'negative-imperative')!
      expect(negTener.conjugations.map((c) => c.form)).toEqual([
        'no tengas', 'no tenga', 'no tengamos', 'no tengáis', 'no tengan',
      ])

      const ir = conjugateVerb('ir')!
      const negIr = ir.tenses.find((t) => t.tenseId === 'negative-imperative')!
      expect(negIr.conjugations.map((c) => c.form)).toEqual([
        'no vayas', 'no vaya', 'no vayamos', 'no vayáis', 'no vayan',
      ])
    })

    it('negative imperative for reflexive verbs places the pronoun after "no"', () => {
      const result = conjugateVerb('quejarse')!
      const negative = result.tenses.find((t) => t.tenseId === 'negative-imperative')!
      expect(negative.conjugations.map((c) => c.form)).toEqual([
        'no te quejes', 'no se queje', 'no nos quejemos', 'no os quejéis', 'no se quejen',
      ])
    })

    it('includes preterite progressive forms', () => {
      const result = conjugateVerb('hablar')!
      const preteriteProgressive = result.tenses.find((t) => t.tenseId === 'preterite-progressive')!

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

  describe('edge cases', () => {
    it('returns null for non-verb words', () => {
      expect(conjugateVerb('casa')).toBeNull()
      expect(conjugateVerb('bien')).toBeNull()
      expect(conjugateVerb('xyz')).toBeNull()
    })
  })
})
