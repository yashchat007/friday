import type { FridaySettings } from '../../../../shared/types/ipc'
import { appendAssistantToolTurn, appendToolResultTurns } from '../ollama-history'
import type { UserIntent } from '../intent-router'
import type {
  AutomationSession,
  AutomationTurnInput,
  ConversationTurnInput,
  LlmProvider,
  ModelToolCall,
  ProviderReadiness
} from './model-types'
import { resolveOllamaCapabilities } from './provider-capabilities'
import { summarizeOllamaPayload } from '../chat-context'
import { checkOllamaStatus, runOllamaTurn } from './ollama-client'
import { ollamaRequestOptions, resolveOllamaModel } from './ollama-options'
import { fetchOllamaRuntime, modelLoaded, usingGpu } from './ollama-runtime'
import type { OllamaChatMessage } from './ollama-types'

export class OllamaProvider implements LlmProvider {
  readonly id = 'ollama' as const

  constructor(private readonly settings: FridaySettings) {}

  getCapabilities() {
    return resolveOllamaCapabilities(this.settings)
  }

  async checkReady(): Promise<ProviderReadiness> {
    const model = resolveOllamaModel(this.settings, 'conversation')
    const status = await checkOllamaStatus(this.settings.ollamaBaseUrl, model)
    if (!status.reachable || !status.modelAvailable) {
      return { ready: false, error: status.error ?? 'Ollama is not ready.' }
    }
    return {
      ready: true,
      detail: status.version ? `Ollama ${status.version}` : undefined
    }
  }

  async runConversationTurn(input: ConversationTurnInput) {
    const intent = input.intent ?? 'conversation'
    const model = resolveOllamaModel(this.settings, intent)
    const options = ollamaRequestOptions(this.settings, intent)
    const messages = input.messages.map((m) => ({ role: m.role, content: m.content }))
    const runtimeBefore = await fetchOllamaRuntime(this.settings.ollamaBaseUrl)
    const payload = summarizeOllamaPayload({
      model,
      systemInstruction: input.systemInstruction,
      messages,
      keepAlive: options.keep_alive,
      numPredict: options.num_predict,
      historyIncluded: input.historyIncluded ?? true
    })

    return runOllamaTurn({
      baseUrl: this.settings.ollamaBaseUrl,
      model,
      systemInstruction: input.systemInstruction,
      messages,
      tools: input.tools,
      options,
      requestMeta: {
        ollamaModel: payload.model,
        keepAlive: payload.keepAlive,
        numPredict: payload.numPredict,
        historyIncluded: payload.historyIncluded,
        historyMessageCount: payload.historyMessageCount,
        systemChars: payload.systemChars,
        totalPayloadChars: payload.totalPayloadChars,
        modelLoadedBeforeRequest: modelLoaded(runtimeBefore, model),
        usingGpu: usingGpu(runtimeBefore, model)
      },
      onText: input.onText,
      onFirstToken: input.onFirstToken,
      signal: input.signal
    })
  }

  beginAutomationSession(initialUserContent: string): AutomationSession {
    const messages: OllamaChatMessage[] = [{ role: 'user', content: initialUserContent }]
    const intent: UserIntent = 'automation'
    return {
      runTurn: (turn: AutomationTurnInput) =>
        runOllamaTurn({
          baseUrl: this.settings.ollamaBaseUrl,
          model: resolveOllamaModel(this.settings, intent),
          systemInstruction: turn.systemInstruction,
          messages,
          tools: turn.tools,
          options: ollamaRequestOptions(this.settings, intent),
          onText: turn.onText,
          onFirstToken: turn.onFirstToken,
          signal: turn.signal
        }),
      recordAssistantTurn: (text: string, toolCalls: ModelToolCall[]) => {
        appendAssistantToolTurn(messages, text, toolCalls)
      },
      recordToolResults: (toolCalls, results) => {
        appendToolResultTurns(messages, toolCalls, results)
      },
      appendUserMessage: (text: string) => {
        messages.push({ role: 'user', content: text })
      }
    }
  }
}
