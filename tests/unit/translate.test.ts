import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { translateText } from '../../src/services/translate'

describe('Google Translate client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('parses a successful translation response', async () => {
    const mockResponse = [
      [['hola', 'hello', null, null, 10]],
      null,
      'en',
    ]

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await translateText('hello', 'en', 'es')
    expect(result.translatedText).toBe('hola')
    expect(result.detectedSourceLanguage).toBe('en')
  })

  it('handles multi-segment responses', async () => {
    const mockResponse = [
      [
        ['Hola ', 'Hello ', null, null, 10],
        ['mundo', 'world', null, null, 10],
      ],
      null,
      'en',
    ]

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await translateText('Hello world', 'en', 'es')
    expect(result.translatedText).toBe('Hola mundo')
  })

  it('throws on HTTP error response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    } as Response)

    await expect(translateText('hello', 'en', 'es')).rejects.toThrow('Translation failed: 429')
  })

  it('throws on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

    await expect(translateText('hello', 'en', 'es')).rejects.toThrow('Network error')
  })

  it('throws on unexpected response format', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ unexpected: 'format' }),
    } as Response)

    await expect(translateText('hello', 'en', 'es')).rejects.toThrow('Unexpected translation response format')
  })
})
