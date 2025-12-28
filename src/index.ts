/**
 * Ollama AI Provider Extension for Stina
 *
 * Connects Stina to a local Ollama instance for private, offline AI conversations.
 */

import {
  initializeExtension,
  type ExtensionContext,
  type AIProvider,
  type ModelInfo,
  type ChatMessage,
  type ChatOptions,
  type StreamEvent,
  type Disposable,
} from '@stina/extension-api/runtime'

/**
 * Extension settings interface
 */
interface OllamaSettings extends Record<string, unknown> {
  url: string
  defaultModel: string
}

/**
 * Ollama API response types
 */
interface OllamaTagsResponse {
  models: Array<{
    name: string
    model: string
    modified_at: string
    size: number
    digest: string
    details?: {
      parent_model?: string
      format?: string
      family?: string
      families?: string[]
      parameter_size?: string
      quantization_level?: string
    }
  }>
}

interface OllamaChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface OllamaChatResponse {
  model: string
  created_at: string
  message: OllamaChatMessage
  done: boolean
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

/**
 * Creates the Ollama AI provider
 */
function createOllamaProvider(context: ExtensionContext): AIProvider {
  return {
    id: 'ollama',
    name: 'Ollama',

    async getModels(): Promise<ModelInfo[]> {
      const settings = await context.settings!.getAll<OllamaSettings>()
      const url = settings.url || 'http://localhost:11434'

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
    },

    async *chat(
      messages: ChatMessage[],
      options: ChatOptions
    ): AsyncGenerator<StreamEvent, void, unknown> {
      const settings = await context.settings!.getAll<OllamaSettings>()
      const url = settings.url || 'http://localhost:11434'
      const model = options.model || settings.defaultModel || 'llama3.2'

      context.log.debug('Starting chat with Ollama', { model, messageCount: messages.length })

      // Convert messages to Ollama format
      const ollamaMessages: OllamaChatMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      try {
        const response = await context.network!.fetch(`${url}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: ollamaMessages,
            stream: true,
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

        // Parse the streaming response
        const body = response.body
        if (!body) {
          throw new Error('No response body')
        }

        const reader = body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          buffer += decoder.decode(value, { stream: true })

          // Process complete lines
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim()) continue

            try {
              const data = JSON.parse(line) as OllamaChatResponse

              if (data.message?.content) {
                yield { type: 'content', text: data.message.content }
              }

              if (data.done) {
                // Include usage stats if available
                const usage =
                  data.prompt_eval_count !== undefined && data.eval_count !== undefined
                    ? {
                        inputTokens: data.prompt_eval_count,
                        outputTokens: data.eval_count,
                      }
                    : undefined

                yield { type: 'done', usage }
              }
            } catch {
              context.log.warn('Failed to parse Ollama response line', { line })
            }
          }
        }

        // Process any remaining data in buffer
        if (buffer.trim()) {
          try {
            const data = JSON.parse(buffer) as OllamaChatResponse
            if (data.message?.content) {
              yield { type: 'content', text: data.message.content }
            }
            if (data.done) {
              yield { type: 'done' }
            }
          } catch {
            // Ignore incomplete data
          }
        }
      } catch (error) {
        context.log.error('Ollama chat error', {
          error: error instanceof Error ? error.message : String(error),
        })

        yield {
          type: 'error',
          message: error instanceof Error ? error.message : String(error),
        }
      }
    },
  }
}

/**
 * Extension activation
 */
function activate(context: ExtensionContext): Disposable {
  context.log.info('Activating Ollama provider extension')

  // Create and register the provider
  const provider = createOllamaProvider(context)
  const disposable = context.providers!.register(provider)

  context.log.info('Ollama provider registered successfully')

  return disposable
}

/**
 * Extension deactivation
 */
function deactivate(): void {
  // Cleanup is handled by the disposable returned from activate
}

// Initialize the extension runtime
initializeExtension({ activate, deactivate })
