import { getSettings } from '../db'
import type { VerbData, TenseData } from '../types'

interface LLMMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface LLMResponse {
  text: string
}

async function callAnthropicAPI(
  apiKey: string,
  model: string,
  messages: LLMMessage[]
): Promise<LLMResponse> {
  const systemMsg = messages.find((m) => m.role === 'system')
  const userMessages = messages.filter((m) => m.role !== 'system')

  const body: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    messages: userMessages.map((m) => ({ role: m.role, content: m.content })),
  }

  if (systemMsg) {
    body.system = systemMsg.content
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    if (response.status === 401) throw new Error('Invalid API key')
    if (response.status === 429) throw new Error('Rate limited. Please try again later.')
    throw new Error(`LLM API error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const text = data.content?.[0]?.text || ''
  return { text }
}

async function callOpenAIAPI(
  apiKey: string,
  model: string,
  messages: LLMMessage[]
): Promise<LLMResponse> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    if (response.status === 401) throw new Error('Invalid API key')
    if (response.status === 429) throw new Error('Rate limited. Please try again later.')
    throw new Error(`LLM API error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content || ''
  return { text }
}

export async function callLLM(messages: LLMMessage[]): Promise<LLMResponse> {
  const settings = await getSettings()

  if (!settings.llmApiKey) {
    throw new Error('No API key configured. Go to Settings to add your LLM API key.')
  }

  if (settings.llmProvider === 'anthropic') {
    return callAnthropicAPI(settings.llmApiKey, settings.llmModel, messages)
  } else {
    return callOpenAIAPI(settings.llmApiKey, settings.llmModel, messages)
  }
}

const CONJUGATION_PROMPT = `You are a Spanish language expert. Given a Spanish verb, provide its complete conjugation data in JSON format.

Return ONLY valid JSON with this structure (no markdown, no explanation):
{
  "infinitive": "the verb",
  "tenses": [
    {
      "tenseId": "present",
      "tenseName": "Present",
      "description": "When this tense is used",
      "conjugations": [
        {"person": "yo", "form": "conjugated form", "miniTranslation": "I verb"},
        {"person": "tú", "form": "...", "miniTranslation": "you verb"},
        {"person": "él/ella/usted", "form": "...", "miniTranslation": "he/she verbs"},
        {"person": "nosotros/as", "form": "...", "miniTranslation": "we verb"},
        {"person": "vosotros/as", "form": "...", "miniTranslation": "you all verb"},
        {"person": "ellos/ellas/ustedes", "form": "...", "miniTranslation": "they verb"}
      ]
    }
  ]
}

Include these tenses: present, preterite, imperfect, future, conditional, present-subjunctive, imperfect-subjunctive, imperative, present-perfect, pluperfect, future-perfect, conditional-perfect.

For compound tenses, show the full form (e.g. "he comido", "había comido").
For imperative, only include tú, usted, nosotros, vosotros, ustedes.`

export async function hydrateConjugation(verb: string): Promise<VerbData> {
  const response = await callLLM([
    { role: 'system', content: CONJUGATION_PROMPT },
    { role: 'user', content: `Conjugate the Spanish verb: ${verb}` },
  ])

  let parsed: { infinitive: string; tenses: TenseData[] }
  try {
    // Try to extract JSON from the response
    let jsonText = response.text.trim()
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error('Failed to parse conjugation data from LLM response')
  }

  if (!parsed.infinitive || !Array.isArray(parsed.tenses)) {
    throw new Error('Invalid conjugation data structure from LLM')
  }

  return {
    infinitive: parsed.infinitive,
    language: 'spanish',
    tenses: parsed.tenses,
  }
}

const SENTENCE_PROMPT = `You are a Spanish language teacher. Generate a natural Spanish sentence that incorporates the specified vocabulary and grammar constructs.

Return ONLY valid JSON (no markdown, no explanation):
{
  "sourceText": "The English sentence",
  "targetText": "The Spanish sentence"
}

The sentence should be natural and at an intermediate level.`

export async function generatePracticeSentence(
  verb: string | null,
  adjective: string | null,
  tense: string | null
): Promise<{ sourceText: string; targetText: string }> {
  const parts: string[] = []
  if (verb) parts.push(`verb: ${verb}`)
  if (adjective) parts.push(`adjective: ${adjective}`)
  if (tense) parts.push(`tense: ${tense}`)

  const prompt = parts.length > 0
    ? `Generate a Spanish sentence using: ${parts.join(', ')}`
    : 'Generate a random Spanish sentence at intermediate level'

  const response = await callLLM([
    { role: 'system', content: SENTENCE_PROMPT },
    { role: 'user', content: prompt },
  ])

  let parsed: { sourceText: string; targetText: string }
  try {
    let jsonText = response.text.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error('Failed to parse sentence from LLM response')
  }

  return parsed
}
