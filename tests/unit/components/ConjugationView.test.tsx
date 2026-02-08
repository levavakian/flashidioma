import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConjugationView from '../../../src/components/cards/ConjugationView'
import type { VerbData } from '../../../src/types'

const verbData: VerbData = {
  infinitive: 'hablar',
  language: 'spanish',
  tenses: [
    {
      tenseId: 'present',
      tenseName: 'Present',
      description: 'Actions happening now',
      conjugations: [
        { person: 'yo', form: 'hablo', miniTranslation: 'I speak' },
        { person: 'tú', form: 'hablas', miniTranslation: 'you speak' },
        { person: 'él/ella', form: 'habla', miniTranslation: 'he/she speaks' },
      ],
    },
    {
      tenseId: 'preterite',
      tenseName: 'Preterite',
      description: 'Completed past actions',
      conjugations: [
        { person: 'yo', form: 'hablé', miniTranslation: 'I spoke' },
        { person: 'tú', form: 'hablaste', miniTranslation: 'you spoke' },
      ],
    },
  ],
}

describe('ConjugationView', () => {
  it('is collapsed by default — tense content is not visible', () => {
    render(<ConjugationView verbData={verbData} />)

    // The toggle button with the infinitive should be visible
    expect(screen.getByText(/Conjugations \(hablar\)/)).toBeInTheDocument()

    // Tense headers should NOT be visible when collapsed
    expect(screen.queryByText('Present')).not.toBeInTheDocument()
    expect(screen.queryByText('Preterite')).not.toBeInTheDocument()

    // Conjugation forms should NOT be visible
    expect(screen.queryByText('hablo')).not.toBeInTheDocument()
  })

  it('clicking the main toggle expands to show tense headers', async () => {
    const user = userEvent.setup()
    render(<ConjugationView verbData={verbData} />)

    // Click the main toggle to expand
    await user.click(screen.getByText(/Conjugations \(hablar\)/))

    // Tense headers should now be visible
    expect(screen.getByText('Present')).toBeInTheDocument()
    expect(screen.getByText('Preterite')).toBeInTheDocument()

    // But conjugation forms should still not be visible (tenses are collapsed)
    expect(screen.queryByText('hablo')).not.toBeInTheDocument()
    expect(screen.queryByText('hablé')).not.toBeInTheDocument()
  })

  it('clicking a tense header expands that tense showing conjugation forms and mini translations', async () => {
    const user = userEvent.setup()
    render(<ConjugationView verbData={verbData} />)

    // Expand the main section
    await user.click(screen.getByText(/Conjugations \(hablar\)/))

    // Click the Present tense header to expand it
    await user.click(screen.getByText('Present'))

    // Present conjugation forms should now be visible
    expect(screen.getByText('hablo')).toBeInTheDocument()
    expect(screen.getByText('hablas')).toBeInTheDocument()
    expect(screen.getByText('habla')).toBeInTheDocument()

    // Mini translations should be visible
    expect(screen.getByText('I speak')).toBeInTheDocument()
    expect(screen.getByText('you speak')).toBeInTheDocument()
    expect(screen.getByText('he/she speaks')).toBeInTheDocument()

    // Person labels should be visible
    expect(screen.getByText('yo')).toBeInTheDocument()
    expect(screen.getByText('tú')).toBeInTheDocument()
    expect(screen.getByText('él/ella')).toBeInTheDocument()

    // Preterite forms should still NOT be visible
    expect(screen.queryByText('hablé')).not.toBeInTheDocument()
    expect(screen.queryByText('hablaste')).not.toBeInTheDocument()
  })

  it('tense descriptions are visible when a tense is expanded', async () => {
    const user = userEvent.setup()
    render(<ConjugationView verbData={verbData} />)

    // Expand the main section
    await user.click(screen.getByText(/Conjugations \(hablar\)/))

    // Description should not be visible before expanding tense
    expect(screen.queryByText('Actions happening now')).not.toBeInTheDocument()

    // Expand the Present tense
    await user.click(screen.getByText('Present'))

    // Description should now be visible
    expect(screen.getByText('Actions happening now')).toBeInTheDocument()

    // Expand the Preterite tense
    await user.click(screen.getByText('Preterite'))

    // Preterite description should also be visible
    expect(screen.getByText('Completed past actions')).toBeInTheDocument()
  })

  it('filters tenses by enabled constructs', async () => {
    const user = userEvent.setup()
    render(
      <ConjugationView
        verbData={verbData}
        enabledConstructs={{ present: true, preterite: false }}
      />
    )

    // Expand the main section
    await user.click(screen.getByText(/Conjugations \(hablar\)/))

    // Only present tense should be visible
    expect(screen.getByText('Present')).toBeInTheDocument()
    expect(screen.queryByText('Preterite')).not.toBeInTheDocument()
  })

  it('shows all tenses when no construct checklist is provided', async () => {
    const user = userEvent.setup()
    render(<ConjugationView verbData={verbData} />)

    // Expand the main section
    await user.click(screen.getByText(/Conjugations \(hablar\)/))

    // Both tenses should be visible
    expect(screen.getByText('Present')).toBeInTheDocument()
    expect(screen.getByText('Preterite')).toBeInTheDocument()
  })
})
