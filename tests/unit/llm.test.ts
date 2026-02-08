import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { db, updateSettings } from '../../src/db'
import { callLLM, hydrateConjugation, generatePracticeSentence } from '../../src/services/llm'

// --- MSW server setup ---

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

beforeEach(async () => {
  await db.settings.clear()
})

// --- Anthropic API tests ---

describe('Anthropic API client', () => {
  beforeEach(async () => {
    await updateSettings({
      llmProvider: 'anthropic',
      llmApiKey: 'test-anthropic-key',
      llmModel: 'claude-sonnet-4-20250514',
    })
  })

  it('parses a successful response', async () => {
    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        return HttpResponse.json({
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello from Anthropic!' }],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
        })
      })
    )

    const result = await callLLM([
      { role: 'user', content: 'Say hello' },
    ])

    expect(result.text).toBe('Hello from Anthropic!')
  })

  it('returns empty string when content array is empty', async () => {
    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        return HttpResponse.json({
          id: 'msg_empty',
          type: 'message',
          role: 'assistant',
          content: [],
        })
      })
    )

    const result = await callLLM([
      { role: 'user', content: 'empty response' },
    ])

    expect(result.text).toBe('')
  })

  it('throws user-friendly error on 401 (bad key)', async () => {
    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        return new HttpResponse('Unauthorized', { status: 401 })
      })
    )

    await expect(
      callLLM([{ role: 'user', content: 'test' }])
    ).rejects.toThrow('Invalid API key')
  })

  it('throws user-friendly error on 429 (rate limit)', async () => {
    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        return new HttpResponse('Too Many Requests', { status: 429 })
      })
    )

    await expect(
      callLLM([{ role: 'user', content: 'test' }])
    ).rejects.toThrow('Rate limited. Please try again later.')
  })
})

// --- OpenAI API tests ---

describe('OpenAI API client', () => {
  beforeEach(async () => {
    await updateSettings({
      llmProvider: 'openai',
      llmApiKey: 'test-openai-key',
      llmModel: 'gpt-4o',
    })
  })

  it('parses a successful response', async () => {
    server.use(
      http.post('https://api.openai.com/v1/chat/completions', () => {
        return HttpResponse.json({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Hello from OpenAI!' },
              finish_reason: 'stop',
            },
          ],
        })
      })
    )

    const result = await callLLM([
      { role: 'user', content: 'Say hello' },
    ])

    expect(result.text).toBe('Hello from OpenAI!')
  })

  it('returns empty string when choices array is empty', async () => {
    server.use(
      http.post('https://api.openai.com/v1/chat/completions', () => {
        return HttpResponse.json({
          id: 'chatcmpl-empty',
          object: 'chat.completion',
          choices: [],
        })
      })
    )

    const result = await callLLM([
      { role: 'user', content: 'empty response' },
    ])

    expect(result.text).toBe('')
  })

  it('throws user-friendly error on 401 (bad key)', async () => {
    server.use(
      http.post('https://api.openai.com/v1/chat/completions', () => {
        return new HttpResponse('Unauthorized', { status: 401 })
      })
    )

    await expect(
      callLLM([{ role: 'user', content: 'test' }])
    ).rejects.toThrow('Invalid API key')
  })

  it('throws user-friendly error on 429 (rate limit)', async () => {
    server.use(
      http.post('https://api.openai.com/v1/chat/completions', () => {
        return new HttpResponse('Too Many Requests', { status: 429 })
      })
    )

    await expect(
      callLLM([{ role: 'user', content: 'test' }])
    ).rejects.toThrow('Rate limited. Please try again later.')
  })
})

// --- callLLM settings validation ---

describe('callLLM settings validation', () => {
  it('throws when no API key is configured', async () => {
    // Default settings have an empty API key
    await updateSettings({ llmApiKey: '' })

    await expect(
      callLLM([{ role: 'user', content: 'test' }])
    ).rejects.toThrow('No API key configured')
  })
})

// --- hydrateConjugation parsing ---

describe('hydrateConjugation', () => {
  beforeEach(async () => {
    await updateSettings({
      llmProvider: 'anthropic',
      llmApiKey: 'test-key',
      llmModel: 'claude-sonnet-4-20250514',
    })
  })

  it('parses a valid conjugation JSON response', async () => {
    const conjugationData = {
      infinitive: 'hablar',
      tenses: [
        {
          tenseId: 'present',
          tenseName: 'Present',
          description: 'Actions happening now',
          conjugations: [
            { person: 'yo', form: 'hablo', miniTranslation: 'I speak' },
            { person: 'tú', form: 'hablas', miniTranslation: 'you speak' },
            { person: 'él/ella/usted', form: 'habla', miniTranslation: 'he/she speaks' },
            { person: 'nosotros/as', form: 'hablamos', miniTranslation: 'we speak' },
            { person: 'vosotros/as', form: 'habláis', miniTranslation: 'you all speak' },
            { person: 'ellos/ellas/ustedes', form: 'hablan', miniTranslation: 'they speak' },
          ],
        },
      ],
    }

    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        return HttpResponse.json({
          content: [{ type: 'text', text: JSON.stringify(conjugationData) }],
        })
      })
    )

    const result = await hydrateConjugation('hablar')

    expect(result.infinitive).toBe('hablar')
    expect(result.language).toBe('spanish')
    expect(result.tenses).toHaveLength(1)
    expect(result.tenses[0].tenseId).toBe('present')
    expect(result.tenses[0].conjugations).toHaveLength(6)
    expect(result.tenses[0].conjugations[0].form).toBe('hablo')
  })

  it('strips markdown code fences from the response', async () => {
    const conjugationData = {
      infinitive: 'comer',
      tenses: [
        {
          tenseId: 'present',
          tenseName: 'Present',
          description: 'Actions happening now',
          conjugations: [
            { person: 'yo', form: 'como', miniTranslation: 'I eat' },
          ],
        },
      ],
    }

    const wrappedText = '```json\n' + JSON.stringify(conjugationData) + '\n```'

    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        return HttpResponse.json({
          content: [{ type: 'text', text: wrappedText }],
        })
      })
    )

    const result = await hydrateConjugation('comer')

    expect(result.infinitive).toBe('comer')
    expect(result.language).toBe('spanish')
    expect(result.tenses[0].conjugations[0].form).toBe('como')
  })

  it('throws on invalid JSON', async () => {
    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        return HttpResponse.json({
          content: [{ type: 'text', text: 'not valid json at all' }],
        })
      })
    )

    await expect(hydrateConjugation('hablar')).rejects.toThrow(
      'Failed to parse conjugation data from LLM response'
    )
  })

  it('throws on missing infinitive field', async () => {
    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        return HttpResponse.json({
          content: [{ type: 'text', text: JSON.stringify({ tenses: [] }) }],
        })
      })
    )

    await expect(hydrateConjugation('hablar')).rejects.toThrow(
      'Invalid conjugation data structure from LLM'
    )
  })

  it('throws on missing tenses array', async () => {
    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        return HttpResponse.json({
          content: [{ type: 'text', text: JSON.stringify({ infinitive: 'hablar' }) }],
        })
      })
    )

    await expect(hydrateConjugation('hablar')).rejects.toThrow(
      'Invalid conjugation data structure from LLM'
    )
  })
})

// --- generatePracticeSentence parsing ---

describe('generatePracticeSentence', () => {
  beforeEach(async () => {
    await updateSettings({
      llmProvider: 'openai',
      llmApiKey: 'test-key',
      llmModel: 'gpt-4o',
    })
  })

  it('parses a valid sentence JSON response', async () => {
    const sentenceData = {
      sourceText: 'I eat apples every day.',
      targetText: 'Yo como manzanas todos los días.',
    }

    server.use(
      http.post('https://api.openai.com/v1/chat/completions', () => {
        return HttpResponse.json({
          choices: [
            {
              message: { role: 'assistant', content: JSON.stringify(sentenceData) },
            },
          ],
        })
      })
    )

    const result = await generatePracticeSentence('comer', null, 'present')

    expect(result.sourceText).toBe('I eat apples every day.')
    expect(result.targetText).toBe('Yo como manzanas todos los días.')
  })

  it('handles response wrapped in code fences', async () => {
    const sentenceData = {
      sourceText: 'She would have spoken.',
      targetText: 'Ella habría hablado.',
    }

    const wrappedText = '```json\n' + JSON.stringify(sentenceData) + '\n```'

    server.use(
      http.post('https://api.openai.com/v1/chat/completions', () => {
        return HttpResponse.json({
          choices: [
            {
              message: { role: 'assistant', content: wrappedText },
            },
          ],
        })
      })
    )

    const result = await generatePracticeSentence('hablar', null, 'conditional-perfect')

    expect(result.sourceText).toBe('She would have spoken.')
    expect(result.targetText).toBe('Ella habría hablado.')
  })

  it('works with all null parameters', async () => {
    const sentenceData = {
      sourceText: 'The house is big.',
      targetText: 'La casa es grande.',
    }

    server.use(
      http.post('https://api.openai.com/v1/chat/completions', () => {
        return HttpResponse.json({
          choices: [
            {
              message: { role: 'assistant', content: JSON.stringify(sentenceData) },
            },
          ],
        })
      })
    )

    const result = await generatePracticeSentence(null, null, null)

    expect(result.sourceText).toBe('The house is big.')
    expect(result.targetText).toBe('La casa es grande.')
  })

  it('throws on invalid JSON response', async () => {
    server.use(
      http.post('https://api.openai.com/v1/chat/completions', () => {
        return HttpResponse.json({
          choices: [
            {
              message: { role: 'assistant', content: 'Here is a sentence: Hola mundo' },
            },
          ],
        })
      })
    )

    await expect(
      generatePracticeSentence('hablar', null, 'present')
    ).rejects.toThrow('Failed to parse sentence from LLM response')
  })
})
