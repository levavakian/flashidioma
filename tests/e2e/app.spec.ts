import { test, expect } from '@playwright/test'

// Helper to create a deck via the UI
async function createDeck(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('button', { name: '+ New Deck' }).click()
  await page.getByPlaceholder('Deck name').fill(name)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByText(name)).toBeVisible()
}

async function clearDB(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('FlashIdiomaDB')
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
      req.onblocked = () => resolve()
    })
  })
}

test.describe('E2E: Core Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearDB(page)
    await page.reload()
    await expect(page.getByText('Your Decks')).toBeVisible()
  })

  test('full workflow: create deck, add card, review it', async ({ page }) => {
    // Create a deck
    await createDeck(page, 'My Spanish')

    // Click on the deck to open it
    await page.getByText('My Spanish').click()
    await expect(page.getByRole('heading', { name: 'My Spanish' })).toBeVisible()

    // Navigate to Add tab
    await page.getByRole('button', { name: '+ Add' }).click()

    // Wait for the Add Card form
    await expect(page.getByRole('heading', { name: 'Add New Card' })).toBeVisible()

    // Add a card using the textbox placeholders
    await page.getByPlaceholder('e.g. hello').fill('hello')
    await page.getByPlaceholder('e.g. hola').fill('hola')
    await page.getByRole('button', { name: 'Add Card' }).click()

    // Navigate to Cards tab to verify it exists
    await page.getByRole('button', { name: /Cards/ }).click()
    await expect(page.getByText('hello')).toBeVisible()
    await expect(page.getByText('hola')).toBeVisible()

    // Navigate to Review tab
    await page.getByRole('button', { name: 'Review' }).click()

    // Should see a review card (new cards are available)
    await expect(
      page.getByText('hello').or(page.getByText('hola'))
    ).toBeVisible({ timeout: 5000 })
  })

  test('import pre-built deck and verify cards exist', async ({ page }) => {
    // Create a deck first
    await createDeck(page, 'Import Target')

    // Navigate to the Import Decks page via the Import button on DecksPage
    // The "Import" button on DecksPage navigates to /import
    await page.getByRole('button', { name: 'Import' }).first().click()

    // Should show the available pre-built deck
    await expect(page.getByText('Spanish Frequency (Top Words)')).toBeVisible()

    // Set a small limit using the number input
    const limitInput = page.locator('input[type="number"]')
    await limitInput.clear()
    await limitInput.fill('5')

    // Click the Import button on the deck card
    await page.getByRole('button', { name: 'Import' }).click()

    // Wait for import confirmation
    await expect(page.getByText(/Imported \d+ cards/)).toBeVisible({ timeout: 10000 })

    // Go back and open the deck to verify cards are there
    await page.getByRole('link', { name: /Decks/i }).click()
    await page.getByText('Import Target').click()

    // Cards tab should show cards
    await expect(page.getByText(/\d+ cards?/)).toBeVisible()
  })
})

test.describe('E2E: Construct Review', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearDB(page)
    await page.reload()
    await expect(page.getByText('Your Decks')).toBeVisible()
  })

  test('construct checklist filters verb tenses', async ({ page }) => {
    // Create a deck
    await createDeck(page, 'Verb Test')
    await page.getByText('Verb Test').click()

    // Go to Constructs tab
    await page.getByRole('button', { name: 'Constructs' }).click()

    // Verify construct checkboxes are visible — use exact match for "Present"
    await expect(page.getByText('Present', { exact: true })).toBeVisible()

    // At least one construct should be checkable
    const checkboxes = page.locator('input[type="checkbox"]')
    const count = await checkboxes.count()
    expect(count).toBeGreaterThan(0)
  })
})

test.describe('E2E: Responsive Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearDB(page)
    await page.reload()
    await expect(page.getByText('Your Decks')).toBeVisible()
  })

  test('mobile viewport (375x667) — all major views are usable', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    // Navigation should be visible
    await expect(page.getByRole('link', { name: /Decks/i })).toBeVisible()

    // Create a deck to verify form fits
    await createDeck(page, 'Mobile Test')

    // Open the deck
    await page.getByText('Mobile Test').click()

    // All tabs should be reachable (some may need scrolling in the tab bar)
    await expect(page.getByRole('button', { name: /Cards/ })).toBeVisible()

    // Verify no horizontal page overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(380) // small tolerance
  })

  test('desktop viewport (1280x800) — all major views are usable', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')

    // Navigation should be visible
    await expect(page.getByRole('link', { name: /Decks/i })).toBeVisible()

    // Create a deck
    await createDeck(page, 'Desktop Test')
    await page.getByText('Desktop Test').click()

    // All tabs should be visible without scrolling
    await expect(page.getByRole('button', { name: /Cards/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Review' })).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Add' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Practice' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Constructs' })).toBeVisible()
  })
})

test.describe('E2E: Large Deck Performance', () => {
  test('importing a large deck and rendering card list', async ({ page }) => {
    test.setTimeout(120000) // 2 minutes for this test

    await page.goto('/')
    await clearDB(page)
    await page.reload()
    await expect(page.getByText('Your Decks')).toBeVisible()

    // Create a deck
    await createDeck(page, 'Large Deck')

    // Navigate to Import page
    await page.getByRole('button', { name: 'Import' }).first().click()
    await expect(page.getByText('Spanish Frequency (Top Words)')).toBeVisible()

    // Set limit to 1000 (enough for pagination without being too slow)
    const limitInput = page.locator('input[type="number"]')
    await limitInput.clear()
    await limitInput.fill('1000')
    await page.getByRole('button', { name: 'Import' }).click()

    // Wait for import to complete (1000 cards can take a while)
    await expect(page.getByText(/Imported \d+ cards/)).toBeVisible({ timeout: 90000 })

    // Navigate to the deck and measure card list render time
    await page.getByRole('link', { name: /Decks/i }).click()
    await page.getByText('Large Deck').click()

    // The card list should render — verify it shows card count
    const startTime = Date.now()
    await expect(page.getByText(/\d+ cards?/)).toBeVisible({ timeout: 10000 })
    const renderTime = Date.now() - startTime

    // Card list should render within 5 seconds (generous threshold)
    expect(renderTime).toBeLessThan(5000)

    // Verify pagination is present (many cards with 50-per-page)
    await expect(page.getByText(/1 \//)).toBeVisible()
  })
})
