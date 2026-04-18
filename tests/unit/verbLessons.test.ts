import { describe, it, expect } from 'vitest'
import { getSpanishLessons } from '../../src/services/verbLessons'

describe('getSpanishLessons', () => {
  it('returns one lesson per construct', async () => {
    const lessons = await getSpanishLessons()
    const ids = lessons.map((l) => l.tenseId)
    expect(ids).toContain('present')
    expect(ids).toContain('preterite')
    expect(ids).toContain('imperfect')
    expect(ids).toContain('imperative')
    expect(ids).toContain('present-perfect')
    expect(ids).toContain('present-progressive')
    expect(ids).toContain('poder-present')
    expect(ids).toContain('deber-present')
  })

  it('preterite has -ar and merged -er/-ir endings tables', async () => {
    const lessons = await getSpanishLessons()
    const pret = lessons.find((l) => l.tenseId === 'preterite')!
    expect(pret.endingsTables).toHaveLength(2)
    const ar = pret.endingsTables.find((t) => t.verbTypes.includes('-ar'))!
    const erIr = pret.endingsTables.find((t) => t.verbTypes.includes('-er'))!
    expect(ar.endings).toEqual(['é', 'aste', 'ó', 'amos', 'asteis', 'aron'])
    expect(erIr.verbTypes).toEqual(['-er', '-ir'])
    expect(erIr.endings).toEqual(['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'])
  })

  it('present has 3 separate ending tables (-ar/-er/-ir)', async () => {
    const lessons = await getSpanishLessons()
    const pres = lessons.find((l) => l.tenseId === 'present')!
    expect(pres.endingsTables).toHaveLength(3)
  })

  it('preterite has the strong-stem and j-stem irregular groups', async () => {
    const lessons = await getSpanishLessons()
    const pret = lessons.find((l) => l.tenseId === 'preterite')!

    const strong = pret.irregularGroups.find((g) => g.endings.includes('ieron'))
    expect(strong).toBeDefined()
    const strongVerbs = strong!.verbs.map((v) => v.infinitive)
    expect(strongVerbs).toContain('tener')
    expect(strongVerbs).toContain('estar')
    expect(strongVerbs).toContain('poder')
    expect(strongVerbs).toContain('poner')
    expect(strongVerbs).toContain('saber')
    expect(strongVerbs).toContain('hacer')

    const jStem = pret.irregularGroups.find((g) => g.endings.includes('eron'))
    expect(jStem).toBeDefined()
    const jVerbs = jStem!.verbs.map((v) => v.infinitive)
    expect(jVerbs).toContain('decir')
    expect(jVerbs).toContain('conducir')
  })

  it('imperfect detects only ir, ser, ver as irregular', async () => {
    const lessons = await getSpanishLessons()
    const imp = lessons.find((l) => l.tenseId === 'imperfect')!
    const irregularVerbs = [
      ...imp.irregularGroups.flatMap((g) => g.verbs.map((v) => v.infinitive)),
      ...imp.otherIrregulars.map((v) => v.infinitive),
    ]
    expect(irregularVerbs).toContain('ir')
    expect(irregularVerbs).toContain('ser')
    expect(irregularVerbs).toContain('ver')
    expect(irregularVerbs).not.toContain('hablar')
    expect(irregularVerbs).not.toContain('comer')
  })

  it('drops derived verbs in favor of their base (poner kept, suponer dropped)', async () => {
    const lessons = await getSpanishLessons()
    const fut = lessons.find((l) => l.tenseId === 'future')!
    const allVerbs = [
      ...fut.irregularGroups.flatMap((g) => g.verbs.map((v) => v.infinitive)),
      ...fut.otherIrregulars.map((v) => v.infinitive),
    ]
    expect(allVerbs).toContain('poner')
    expect(allVerbs).not.toContain('suponer')
    expect(allVerbs).not.toContain('componer')
    expect(allVerbs).not.toContain('proponer')
  })

  it('does not treat regular -ir verbs as derivatives of "ir"', async () => {
    const lessons = await getSpanishLessons()
    const pp = lessons.find((l) => l.tenseId === 'present-progressive')!
    const all = pp.otherIrregulars.map((v) => v.infinitive)
    expect(all).toContain('sentir')
    expect(all).toContain('dormir')
    expect(all).toContain('decir')
  })

  it('imperative only flags the "irregular tú affirmative" verbs', async () => {
    const lessons = await getSpanishLessons()
    const imp = lessons.find((l) => l.tenseId === 'imperative')!
    const verbs = imp.otherIrregulars.map((v) => v.infinitive)
    expect(verbs).toContain('decir')
    expect(verbs).toContain('hacer')
    expect(verbs).toContain('ir')
    expect(verbs).toContain('poner')
    expect(verbs).toContain('salir')
    expect(verbs).toContain('ser')
    expect(verbs).toContain('tener')
    expect(verbs).toContain('venir')
    expect(verbs).not.toContain('hablar')
    expect(verbs).not.toContain('pedir')
  })

  it('present perfect lists irregular participles like abierto/dicho/hecho', async () => {
    const lessons = await getSpanishLessons()
    const perf = lessons.find((l) => l.tenseId === 'present-perfect')!
    const verbs = perf.otherIrregulars
    expect(verbs.find((v) => v.infinitive === 'abrir')?.hint).toBe('participle abierto')
    expect(verbs.find((v) => v.infinitive === 'decir')?.hint).toBe('participle dicho')
    expect(verbs.find((v) => v.infinitive === 'hacer')?.hint).toBe('participle hecho')
  })

  it('present progressive lists irregular gerunds', async () => {
    const lessons = await getSpanishLessons()
    const prog = lessons.find((l) => l.tenseId === 'present-progressive')!
    const verbs = prog.otherIrregulars
    expect(verbs.find((v) => v.infinitive === 'ir')?.hint).toBe('gerund yendo')
    expect(verbs.find((v) => v.infinitive === 'dormir')?.hint).toBe('gerund durmiendo')
    expect(verbs.find((v) => v.infinitive === 'sentir')?.hint).toBe('gerund sintiendo')
  })

  it('modal constructs (poder-present, deber-present) have no irregular verbs', async () => {
    const lessons = await getSpanishLessons()
    const poder = lessons.find((l) => l.tenseId === 'poder-present')!
    const deber = lessons.find((l) => l.tenseId === 'deber-present')!
    expect(poder.irregularGroups).toHaveLength(0)
    expect(poder.otherIrregulars).toHaveLength(0)
    expect(deber.irregularGroups).toHaveLength(0)
    expect(deber.otherIrregulars).toHaveLength(0)
  })

  it('every lesson has a formation summary', async () => {
    const lessons = await getSpanishLessons()
    for (const l of lessons) {
      expect(l.formationSummary, `tense ${l.tenseId}`).not.toBe('')
    }
  })

  it('memoises results across calls', async () => {
    const a = await getSpanishLessons()
    const b = await getSpanishLessons()
    expect(b).toBe(a)
  })
})
