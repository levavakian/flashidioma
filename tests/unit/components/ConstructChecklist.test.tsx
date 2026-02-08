import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConstructChecklist from '../../../src/components/decks/ConstructChecklist'
import { db } from '../../../src/db'
import type { Deck } from '../../../src/types'

let deck: Deck

beforeEach(async () => {
  await db.decks.clear()
  await db.cards.clear()

  deck = {
    id: 'test-deck',
    name: 'Spanish Vocab',
    targetLanguage: 'spanish',
    createdAt: new Date().toISOString(),
    constructChecklist: {
      present: true,
      preterite: false,
      imperfect: false,
      future: false,
      conditional: false,
      'present-subjunctive': false,
      'imperfect-subjunctive': false,
      imperative: false,
      'present-perfect': false,
      pluperfect: false,
      'future-perfect': false,
      'conditional-perfect': false,
    },
    newCardBatchSize: 5,
    currentBatchCardIds: [],
  }
  await db.decks.put(deck)
})

describe('ConstructChecklist', () => {
  it('toggling a construct on updates the stored state', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(<ConstructChecklist deck={deck} onUpdate={onUpdate} />)

    // "Present" should be checked, "Preterite" should not
    const presentCheckbox = screen.getByRole('checkbox', { name: /^Present\s*-\s*Actions happening now/ })
    const preteriteCheckbox = screen.getByRole('checkbox', { name: /^Preterite\s*-\s*Completed past/ })
    expect(presentCheckbox).toBeChecked()
    expect(preteriteCheckbox).not.toBeChecked()

    // Toggle Preterite ON
    await user.click(preteriteCheckbox)

    // onUpdate should have been called
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalled()
    })

    // Verify the DB was updated — Preterite should now be true
    const updatedDeck = await db.decks.get('test-deck')
    expect(updatedDeck!.constructChecklist.preterite).toBe(true)
    // Present should still be true
    expect(updatedDeck!.constructChecklist.present).toBe(true)
  })

  it('toggling a construct off updates the stored state', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(<ConstructChecklist deck={deck} onUpdate={onUpdate} />)

    // "Present" is currently on
    const presentCheckbox = screen.getByRole('checkbox', { name: /^Present\s*-\s*Actions happening now/ })
    expect(presentCheckbox).toBeChecked()

    // Toggle Present OFF
    await user.click(presentCheckbox)

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalled()
    })

    // Verify the DB was updated — Present should now be false
    const updatedDeck = await db.decks.get('test-deck')
    expect(updatedDeck!.constructChecklist.present).toBe(false)
  })
})
