import type { FridaySettings } from '../../../../shared/types/ipc'
import { appendFunctionResponses, appendModelTurn, appendUserText } from './gemini-history'
import type { GeminiContent } from './gemini-types'
import { DEFAULT_GEMINI_MODEL } from './gemini-types'
import { geminiApiKeyConfigured, runGeminiTurn } from './gemini-client'
import type {
  AutomationSession,
  AutomationTurnInput,
  ConversationTurnInput,
  LlmProvider,
  ModelToolCall,
  ProviderReadiness
} from './model-types'
import { resolveGeminiCapabilities } from './provider-capabilities'

export class GeminiProvider implements LlmProvider {
  readonly id = 'gemini' as const

  constructor(
    private readonly settings: Pick<FridaySettings, 'geminiApiKey' | 'geminiModel'>
  ) {}

  getCapabilities() {
    return resolveGeminiCapabilities(this.settings)
  }

  async checkReady(): Promise<ProviderReadiness> {
    if (!geminiApiKeyConfigured(this.settings.geminiApiKey)) {
      return {
        ready: false,
        error: 'Add a Gemini API key in Settings to use Google as the provider.'
      }
    }
    return { ready: true, detail: `Gemini · ${this.settings.geminiModel || DEFAULT_GEMINI_MODEL}` }
  }

  async runConversationTurn(input: ConversationTurnInput) {
    const contents: GeminiContent[] = input.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
    return runGeminiTurn({
      apiKey: this.settings.geminiApiKey,
      model: this.settings.geminiModel || DEFAULT_GEMINI_MODEL,
      systemInstruction: input.systemInstruction,
      contents,
      tools: input.tools,
      onText: input.onText,
      onFirstToken: input.onFirstToken
    })
  }

  beginAutomationSession(initialUserContent: string): AutomationSession {
    const contents: GeminiContent[] = [{ role: 'user', parts: [{ text: initialUserContent }] }]
    return {
      runTurn: (turn: AutomationTurnInput) =>
        runGeminiTurn({
          apiKey: this.settings.geminiApiKey,
          model: this.settings.geminiModel || DEFAULT_GEMINI_MODEL,
          systemInstruction: turn.systemInstruction,
          contents,
          tools: turn.tools,
          onText: turn.onText,
          onFirstToken: turn.onFirstToken
        }),
      recordAssistantTurn: (text: string, toolCalls: ModelToolCall[]) => {
        appendModelTurn(contents, text, toolCalls)
      },
      recordToolResults: (toolCalls, results) => {
        appendFunctionResponses(contents, toolCalls, results)
      },
      appendUserMessage: (text: string) => {
        appendUserText(contents, text)
      }
    }
  }
}
