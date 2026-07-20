import { describe, it, expect } from 'vitest'
import { getSpanishLessons } from '../../src/services/verbLessons'

const lessons = getSpanishLessons()

function findCategory(tenseId: string, categoryId: string) {
  const lesson = lessons.find((l) => l.tenseId === tenseId)
  if (!lesson) throw new Error(`No lesson for ${tenseId}`)
  const cat = lesson.irregularCategories.find((c) => c.id === categoryId)
  if (!cat) throw new Error(`No category ${categoryId} in ${tenseId}`)
  return cat
}

function categoryVerbs(tenseId: string, categoryId: string) {
  return findCategory(tenseId, categoryId).verbs.map((v) => v.infinitive)
}

describe('getSpanishLessons', () => {
  it('returns one lesson per construct', () => {
    const ids = lessons.map((l) => l.tenseId)
    expect(ids).toContain('present')
    expect(ids).toContain('preterite')
    expect(ids).toContain('imperfect')
    expect(ids).toContain('future')
    expect(ids).toContain('conditional')
    expect(ids).toContain('present-subjunctive')
    expect(ids).toContain('imperfect-subjunctive')
    expect(ids).toContain('perfect-subjunctive')
    expect(ids).toContain('pluperfect-subjunctive')
    expect(ids).toContain('imperative')
    expect(ids).toContain('negative-imperative')
    expect(ids).toContain('present-perfect')
    expect(ids).toContain('present-progressive')
    expect(ids).toContain('poder-present')
    expect(ids).toContain('deber-present')
    expect(ids).toHaveLength(21)
  })

  it('every lesson has a formation summary', () => {
    for (const l of lessons) {
      expect(l.formationSummary, `tense ${l.tenseId}`).not.toBe('')
    }
  })

  it('present has 3 separate ending tables and preterite has -ar plus merged -er/-ir', () => {
    const pres = lessons.find((l) => l.tenseId === 'present')!
    expect(pres.endingsTables).toHaveLength(3)

    const pret = lessons.find((l) => l.tenseId === 'preterite')!
    expect(pret.endingsTables).toHaveLength(2)
    const ar = pret.endingsTables.find((t) => t.verbTypes.includes('-ar'))!
    const erIr = pret.endingsTables.find((t) => t.verbTypes.includes('-er'))!
    expect(ar.endings).toEqual(['é', 'aste', 'ó', 'amos', 'asteis', 'aron'])
    expect(erIr.verbTypes).toEqual(['-er', '-ir'])
    expect(erIr.endings).toEqual(['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'])
  })

  it('present categories cover stem changes, irregular yo, and fully-irregular verbs', () => {
    expect(categoryVerbs('present', 'stem-e-ie')).toContain('querer')
    expect(categoryVerbs('present', 'stem-o-ue')).toContain('poder')
    expect(categoryVerbs('present', 'stem-e-i')).toContain('pedir')
    expect(categoryVerbs('present', 'stem-u-ue')).toContain('jugar')
    expect(categoryVerbs('present', 'yo-go')).toContain('tener')
    expect(categoryVerbs('present', 'yo-zco')).toContain('conocer')
    expect(categoryVerbs('present', 'yo-only')).toContain('saber')
    const fully = categoryVerbs('present', 'fully-irregular')
    expect(fully).toContain('ser')
    expect(fully).toContain('ir')
    expect(fully).toContain('estar')
    expect(fully).toContain('haber')
  })

  it('preterite has strong, j-stem, ir-stem-change, i-to-y, and fully-irregular categories', () => {
    expect(categoryVerbs('preterite', 'strong')).toEqual(
      expect.arrayContaining(['tener', 'estar', 'andar', 'poder', 'poner', 'saber', 'querer', 'venir', 'hacer'])
    )
    expect(categoryVerbs('preterite', 'strong')).not.toContain('dar')
    expect(categoryVerbs('preterite', 'j-stem')).toEqual(
      expect.arrayContaining(['decir', 'traer', 'conducir'])
    )
    expect(categoryVerbs('preterite', 'ir-stem-change-3rd')).toContain('pedir')
    expect(categoryVerbs('preterite', 'ir-stem-change-3rd')).toContain('dormir')
    expect(categoryVerbs('preterite', 'i-to-y')).toContain('leer')
    expect(categoryVerbs('preterite', 'i-to-y')).toContain('construir')

    const fully = categoryVerbs('preterite', 'fully-irregular')
    expect(fully).toContain('ser')
    expect(fully).toContain('ir')
    expect(fully).toContain('dar')
    expect(fully).toContain('ver')
  })

  it('preterite strong category exposes the alt-endings table', () => {
    const cat = findCategory('preterite', 'strong')
    expect(cat.altEndings).toBeDefined()
    expect(cat.altEndings!.endings).toEqual(['e', 'iste', 'o', 'imos', 'isteis', 'ieron'])
  })

  it('preterite j-stem category uses -eron', () => {
    const cat = findCategory('preterite', 'j-stem')
    expect(cat.altEndings!.endings).toEqual(['e', 'iste', 'o', 'imos', 'isteis', 'eron'])
  })

  it('imperfect lists exactly ser, ir, ver as irregular', () => {
    const verbs = categoryVerbs('imperfect', 'all')
    expect(verbs).toEqual(['ser', 'ir', 'ver'])
  })

  it('future and conditional share the same single irregular-stems category', () => {
    const fut = categoryVerbs('future', 'irregular-stems')
    const cond = categoryVerbs('conditional', 'irregular-stems')
    expect(fut).toEqual(cond)
    expect(fut).toContain('tener')
    expect(fut).toContain('hacer')
    expect(fut).toContain('decir')
  })

  it('present subjunctive lists six fully-irregular verbs', () => {
    const verbs = categoryVerbs('present-subjunctive', 'fully-irregular')
    expect(verbs).toEqual(expect.arrayContaining(['ser', 'estar', 'ir', 'haber', 'saber', 'dar']))
  })

  it('imperfect subjunctive irregulars come from the preterite stem', () => {
    const verbs = categoryVerbs('imperfect-subjunctive', 'from-preterite')
    expect(verbs).toContain('tener')
    expect(verbs).toContain('decir')
    expect(verbs).toContain('ir')
    expect(verbs).toContain('leer')
  })

  it('imperative lists every irregular tú affirmative', () => {
    const verbs = categoryVerbs('imperative', 'irregular-tu')
    expect(verbs).toEqual([
      'tener',
      'venir',
      'poner',
      'salir',
      'hacer',
      'decir',
      'ir',
      'ser',
      'haber',
      'satisfacer',
    ])
  })

  it('negative imperative is "no" + present subjunctive with subjunctive irregulars', () => {
    const lesson = lessons.find((l) => l.tenseId === 'negative-imperative')!
    expect(lesson.formationSummary).toMatch(/no/i)
    expect(lesson.formationSummary).toMatch(/present subjunctive/i)

    // Two endings tables: -ar separate, -er/-ir merged, each for the 5 command persons.
    expect(lesson.endingsTables).toHaveLength(2)
    const ar = lesson.endingsTables.find((t) => t.verbTypes.includes('-ar'))!
    const erIr = lesson.endingsTables.find((t) => t.verbTypes.includes('-er'))!
    expect(ar.persons).toEqual(['tú', 'usted', 'nosotros/as', 'vosotros/as', 'ustedes'])
    expect(ar.endings).toEqual(['es', 'e', 'emos', 'éis', 'en'])
    expect(erIr.verbTypes).toEqual(['-er', '-ir'])
    expect(erIr.endings).toEqual(['as', 'a', 'amos', 'áis', 'an'])

    // Inherits the present subjunctive irregular categories.
    expect(categoryVerbs('negative-imperative', 'fully-irregular')).toEqual(
      expect.arrayContaining(['ser', 'estar', 'ir', 'haber', 'saber', 'dar'])
    )
  })

  it('every perfect tense uses the same irregular-participles category', () => {
    for (const tid of [
      'present-perfect', 'pluperfect', 'future-perfect', 'conditional-perfect',
      'perfect-subjunctive', 'pluperfect-subjunctive',
    ]) {
      const verbs = categoryVerbs(tid, 'irregular-participles')
      expect(verbs).toContain('abrir')
      expect(verbs).toContain('decir')
      expect(verbs).toContain('hacer')
      expect(verbs).toContain('volver')
    }
  })

  it('perfect subjunctive lessons describe the subjunctive haber forms', () => {
    const perfSub = lessons.find((l) => l.tenseId === 'perfect-subjunctive')!
    expect(perfSub.formationSummary).toContain('haya')

    const plupSub = lessons.find((l) => l.tenseId === 'pluperfect-subjunctive')!
    expect(plupSub.formationSummary).toContain('hubiera')

    for (const lesson of [perfSub, plupSub]) {
      const cat = lesson.irregularCategories.find((c) => c.id === 'irregular-participles')!
      expect(cat.description).toContain('haya')
    }
  })

  it('every progressive tense uses the same irregular-gerunds categories', () => {
    for (const tid of [
      'present-progressive',
      'preterite-progressive',
      'imperfect-progressive',
      'future-progressive',
    ]) {
      const stemChange = categoryVerbs(tid, 'ir-stem-change-gerund')
      expect(stemChange).toContain('dormir')
      expect(stemChange).toContain('pedir')
      const yendo = categoryVerbs(tid, 'yendo')
      expect(yendo).toContain('leer')
      expect(yendo).toContain('ir')
    }
  })

  it('modal constructs have no irregular categories', () => {
    const poder = lessons.find((l) => l.tenseId === 'poder-present')!
    const deber = lessons.find((l) => l.tenseId === 'deber-present')!
    expect(poder.irregularCategories).toEqual([])
    expect(deber.irregularCategories).toEqual([])
  })

  it('strong preterite is 100% complete (12 base irregular verbs)', () => {
    const verbs = categoryVerbs('preterite', 'strong')
    expect(verbs).toEqual(
      expect.arrayContaining([
        'tener', 'estar', 'andar', 'poder', 'poner', 'saber',
        'caber', 'haber', 'querer', 'venir', 'hacer', 'satisfacer',
      ])
    )
    expect(verbs).toHaveLength(12)
  })

  it('j-stem preterite is 100% complete (11 base irregular verbs)', () => {
    const verbs = categoryVerbs('preterite', 'j-stem')
    expect(verbs).toHaveLength(11)
    expect(verbs).toContain('decir')
    expect(verbs).toContain('traer')
    // The full -ucir family
    for (const v of ['conducir', 'producir', 'traducir', 'reducir', 'introducir', 'deducir', 'inducir', 'seducir', 'aducir']) {
      expect(verbs).toContain(v)
    }
  })

  it('future-stems is 100% complete (13 base irregular verbs)', () => {
    const verbs = categoryVerbs('future', 'irregular-stems')
    expect(verbs).toHaveLength(13)
    expect(verbs).toContain('satisfacer')
  })

  it('imperative tú is 100% complete (10 base irregular verbs)', () => {
    const verbs = categoryVerbs('imperative', 'irregular-tu')
    expect(verbs).toHaveLength(10)
    expect(verbs).toContain('haber')
    expect(verbs).toContain('satisfacer')
  })

  it('does not list derived verbs alongside their base (no suponer when poner is present)', () => {
    const allCuratedVerbs = new Set<string>()
    for (const l of lessons) {
      for (const cat of l.irregularCategories) {
        for (const v of cat.verbs) allCuratedVerbs.add(v.infinitive)
      }
    }
    expect(allCuratedVerbs).not.toContain('suponer')
    expect(allCuratedVerbs).not.toContain('componer')
    expect(allCuratedVerbs).not.toContain('proponer')
    expect(allCuratedVerbs).not.toContain('disponer')
    expect(allCuratedVerbs).toContain('poner')
  })
})
