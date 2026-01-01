/**
 * Ollama AI Provider
 *
 * Implementation of the AIProvider interface for Ollama.
 */

import type {
  ExtensionContext,
  AIProvider,
  ModelInfo,
  ChatMessage,
  ChatOptions,
  GetModelsOptions,
  StreamEvent,
} from '@stina/extension-api/runtime'

import { DEFAULT_OLLAMA_URL, DEFAULT_MODEL, PROVIDER_ID, PROVIDER_NAME } from './constants.js'
import type { OllamaTagsResponse, OllamaChatResponse, OllamaChatMessage } from './types.js'

/**
 * Creates the Ollama AI provider
 */
export function createOllamaProvider(context: ExtensionContext): AIProvider {
  return {
    id: PROVIDER_ID,
    name: PROVIDER_NAME,

    getModels: (options?: GetModelsOptions) => fetchModels(context, options),
    chat: (messages: ChatMessage[], options: ChatOptions) => streamChat(context, messages, options),
  }
}

/**
 * Fetches available models from the Ollama server
 */
async function fetchModels(
  context: ExtensionContext,
  options?: GetModelsOptions
): Promise<ModelInfo[]> {
  const url = (options?.settings?.url as string) || DEFAULT_OLLAMA_URL

  context.log.debug('Fetching models from Ollama', { url })

  try {
    const response = await context.network!.fetch(`${url}/api/tags`)

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as OllamaTagsResponse

    const models: ModelInfo[] = data.models.map((model) => ({
      id: model.name,
      name: model.name,
      description: model.details?.parameter_size
        ? `${model.details.parameter_size} parameters`
        : undefined,
    }))

    context.log.info('Fetched Ollama models', { count: models.length })
    return models
  } catch (error) {
    context.log.error('Failed to fetch Ollama models', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Streams a chat response from the Ollama server
 */
async function* streamChat(
  context: ExtensionContext,
  messages: ChatMessage[],
  options: ChatOptions
): AsyncGenerator<StreamEvent, void, unknown> {
  const url = (options.settings?.url as string) || DEFAULT_OLLAMA_URL
  const model = options.model || DEFAULT_MODEL

  context.log.debug('Starting chat with Ollama', { url, model, messageCount: messages.length })

  // Convert messages to Ollama format
  const ollamaMessages: OllamaChatMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  try {
    // NOTE: stream: false because worker message-passing doesn't support streaming fetch yet
    // The host's handleNetworkFetch uses response.text() which blocks on streaming responses
    const response = await context.network!.fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: ollamaMessages,
        stream: false,
        options: {
          temperature: options.temperature,
          num_predict: options.maxTokens,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Ollama error: ${response.status} - ${errorText}`)
    }

    // With stream: false, we get a single JSON response
    const data = (await response.json()) as OllamaChatResponse

    if (data.message?.content) {
      yield { type: 'content', text: data.message.content }
    }

    // Include usage stats if available
    const usage =
      data.prompt_eval_count !== undefined && data.eval_count !== undefined
        ? {
            inputTokens: data.prompt_eval_count,
            outputTokens: data.eval_count,
          }
        : undefined

    yield { type: 'done', usage }
  } catch (error) {
    context.log.error('Ollama chat error', {
      error: error instanceof Error ? error.message : String(error),
    })

    yield {
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}
