import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsPage from '../../../src/components/settings/SettingsPage'
import { db, getSettings } from '../../../src/db'

beforeEach(async () => {
  await db.settings.clear()
  await db.decks.clear()
  await db.cards.clear()
  await db.reviewHistory.clear()
})

describe('SettingsPage', () => {
  it('entering and saving API key persists it to settings', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)

    // Wait for settings to load (the page fetches settings on mount)
    await waitFor(() => {
      expect(screen.getByText('LLM Configuration')).toBeInTheDocument()
    })

    // Type an API key into the password field
    const apiKeyInput = screen.getByPlaceholderText('sk-ant-...')
    await user.type(apiKeyInput, 'sk-ant-test-key-12345')

    // Click Save
    await user.click(screen.getByText('Save'))

    // Wait for "Saved!" confirmation
    await waitFor(() => {
      expect(screen.getByText('Saved!')).toBeInTheDocument()
    })

    // Verify the key was persisted to the database
    const settings = await getSettings()
    expect(settings.llmApiKey).toBe('sk-ant-test-key-12345')
    expect(settings.llmProvider).toBe('anthropic')
  })

  it('changing provider updates the UI (placeholder text changes)', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)

    // Wait for initial load — default provider is Anthropic
    await waitFor(() => {
      expect(screen.getByPlaceholderText('sk-ant-...')).toBeInTheDocument()
    })

    // The model placeholder should be the Anthropic default
    expect(screen.getByPlaceholderText('claude-sonnet-4-5-20250929')).toBeInTheDocument()

    // Change provider to OpenAI
    const providerSelect = screen.getByDisplayValue('Anthropic (Claude)')
    await user.selectOptions(providerSelect, 'openai')

    // Placeholder text for API Key should now reflect OpenAI
    await waitFor(() => {
      expect(screen.getByPlaceholderText('sk-...')).toBeInTheDocument()
    })

    // Placeholder text for Model should now reflect OpenAI
    expect(screen.getByPlaceholderText('gpt-4o')).toBeInTheDocument()

    // The old Anthropic placeholders should be gone
    expect(screen.queryByPlaceholderText('sk-ant-...')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('claude-sonnet-4-5-20250929')).not.toBeInTheDocument()
  })
})
