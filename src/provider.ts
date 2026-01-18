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
  ToolDefinition,
} from '@stina/extension-api/runtime'

import { DEFAULT_OLLAMA_URL, DEFAULT_MODEL, PROVIDER_ID, PROVIDER_NAME } from './constants.js'
import type { OllamaTagsResponse, OllamaChatResponse, OllamaChatMessage, OllamaTool } from './types.js'

let toolCallCounter = 0

/** Simple ID generator for tool calls */
function generateToolCallId(): string {
  toolCallCounter++
  if (toolCallCounter >= Number.MAX_SAFE_INTEGER) {
    toolCallCounter = 1
  }
  return `call_${Date.now()}_${toolCallCounter.toString(36)}`
}

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
 * Convert tools to Ollama format
 */
function convertToolsToOllama(tools?: ToolDefinition[]): OllamaTool[] | undefined {
  if (!tools || tools.length === 0) return undefined

  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.id,
      description: tool.description,
      parameters: tool.parameters,
    },
  }))
}

/**
 * Convert ChatMessage to Ollama format
 */
function convertMessageToOllama(message: ChatMessage): OllamaChatMessage {
  const base: OllamaChatMessage = {
    role: message.role as OllamaChatMessage['role'],
    content: message.content,
  }

  // Handle tool calls in assistant messages
  if (message.tool_calls && message.tool_calls.length > 0) {
    base.tool_calls = message.tool_calls.map((tc) => ({
      function: {
        name: tc.name,
        arguments: tc.arguments,
      },
    }))
  }

  return base
}

/**
 * Streams a chat response from the Ollama server.
 * Uses streaming fetch to yield content progressively as it arrives.
 */
async function* streamChat(
  context: ExtensionContext,
  messages: ChatMessage[],
  options: ChatOptions
): AsyncGenerator<StreamEvent, void, unknown> {
  const url = (options.settings?.url as string) || DEFAULT_OLLAMA_URL
  const model = options.model || DEFAULT_MODEL

  context.log.debug('Starting streaming chat with Ollama', { url, model, messageCount: messages.length })

  // Convert messages to Ollama format
  const ollamaMessages: OllamaChatMessage[] = messages.map(convertMessageToOllama)

  // Convert tools to Ollama format
  const ollamaTools = convertToolsToOllama(options.tools)

  try {
    const requestBody: Record<string, unknown> = {
      model,
      messages: ollamaMessages,
      stream: true, // Enable streaming
      options: {
        temperature: options.temperature,
        num_predict: options.maxTokens,
      },
    }

    // Add tools if available
    if (ollamaTools && ollamaTools.length > 0) {
      requestBody.tools = ollamaTools
    }

    // Use streaming fetch
    const stream = context.network!.fetchStream(`${url}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    // Check for HTTP errors if the stream exposes response metadata
    const streamAny = stream as any
    if (streamAny) {
      if (typeof streamAny.status === 'number' && streamAny.status >= 400) {
        const status = streamAny.status
        const statusText = typeof streamAny.statusText === 'string' ? streamAny.statusText : 'HTTP error'
        throw new Error(`Ollama streaming chat request failed with status ${status}: ${statusText}`)
      }
      if (typeof streamAny.ok === 'boolean' && !streamAny.ok) {
        const status = typeof streamAny.status === 'number' ? streamAny.status : 'unknown'
        const statusText = typeof streamAny.statusText === 'string' ? streamAny.statusText : 'HTTP error'
        throw new Error(`Ollama streaming chat request failed with status ${status}: ${statusText}`)
      }
    }

    let buffer = ''
    let finalResponse: OllamaChatResponse | null = null

    for await (const chunk of stream) {
      buffer += chunk

      // Parse NDJSON - each line is a complete JSON object
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line for next iteration

      for (const line of lines) {
        if (!line.trim()) continue

        try {
          const data = JSON.parse(line) as OllamaChatResponse

          // Ollama sends cumulative content, so we yield the full text each time
          // ChatStreamService will handle replacing (not appending) the content
          if (data.message?.content) {
            yield { type: 'content', text: data.message.content }
          }

          if (data.done) {
            finalResponse = data

            // Handle tool calls (only present in final response)
            if (data.message?.tool_calls && data.message.tool_calls.length > 0) {
              for (const toolCall of data.message.tool_calls) {
                const toolCallId = generateToolCallId()
                yield {
                  type: 'tool_start',
                  name: toolCall.function.name,
                  input: toolCall.function.arguments,
                  toolCallId,
                }
              }
            }
          }
        } catch (parseError) {
          context.log.warn('Failed to parse streaming chunk', {
            line,
            error: parseError instanceof Error ? parseError.message : String(parseError),
          })
        }
      }
    }

    // Process any remaining data in the buffer (in case the final chunk lacked a trailing newline)
    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer) as OllamaChatResponse

        if (data.message?.content) {
          yield { type: 'content', text: data.message.content }
        }

        if (data.done) {
          finalResponse = data

          if (data.message?.tool_calls && data.message.tool_calls.length > 0) {
            for (const toolCall of data.message.tool_calls) {
              const toolCallId = generateToolCallId()
              yield {
                type: 'tool_start',
                name: toolCall.function.name,
                input: toolCall.function.arguments,
                toolCallId,
              }
            }
          }
        }
      } catch (parseError) {
        context.log.warn('Failed to parse remaining streaming buffer', {
          line: buffer,
          error: parseError instanceof Error ? parseError.message : String(parseError),
        })
      }
    }

    // Verify that we received a complete stream with a final response
    if (!finalResponse) {
      context.log.warn('Streaming response completed without receiving final chunk (done=true)')
    }

    // Include usage stats if available from final response
    const usage =
      finalResponse?.prompt_eval_count !== undefined && finalResponse?.eval_count !== undefined
        ? {
            inputTokens: finalResponse.prompt_eval_count,
            outputTokens: finalResponse.eval_count,
          }
        : undefined

    yield { type: 'done', usage }
  } catch (error) {
    context.log.error('Ollama streaming chat error', {
      error: error instanceof Error ? error.message : String(error),
    })

    yield {
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}
