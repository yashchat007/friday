export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash'

export type GeminiContent = {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

export type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } }
