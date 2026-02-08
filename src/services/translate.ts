export interface TranslationResult {
  translatedText: string
  detectedSourceLanguage?: string
}

/**
 * Translate text using Google Translate's unofficial web endpoint.
 * No API key required but may be rate-limited.
 */
export async function translateText(
  text: string,
  sourceLang: string = 'auto',
  targetLang: string = 'en'
): Promise<TranslationResult> {
  const params = new URLSearchParams({
    client: 'gtx',
    sl: sourceLang,
    tl: targetLang,
    dt: 't',
    q: text,
  })

  const url = `https://translate.googleapis.com/translate_a/single?${params}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Translation failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  // Response format: [[["translated text","original text",null,null,N],...],null,"detected_lang"]
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error('Unexpected translation response format')
  }

  const translatedText = data[0]
    .map((segment: unknown[]) => (segment && segment[0]) || '')
    .join('')

  const detectedSourceLanguage = data[2] as string | undefined

  return { translatedText, detectedSourceLanguage }
}

/**
 * Check if the browser is online.
 */
export function isOnline(): boolean {
  return navigator.onLine
}
