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
  toolCallCounter = (toolCallCounter + 1) % Number.MAX_SAFE_INTEGER
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
  const ollamaMessages: OllamaChatMessage[] = messages.map(convertMessageToOllama)

  // Convert tools to Ollama format
  const ollamaTools = convertToolsToOllama(options.tools)

  try {
    // NOTE: stream: false because worker message-passing doesn't support streaming fetch yet
    // The host's handleNetworkFetch uses response.text() which blocks on streaming responses
    const requestBody: Record<string, unknown> = {
      model,
      messages: ollamaMessages,
      stream: false,
      options: {
        temperature: options.temperature,
        num_predict: options.maxTokens,
      },
    }

    // Add tools if available
    if (ollamaTools && ollamaTools.length > 0) {
      requestBody.tools = ollamaTools
    }

    const response = await context.network!.fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Ollama error: ${response.status} - ${errorText}`)
    }

    // With stream: false, we get a single JSON response
    const data = (await response.json()) as OllamaChatResponse

    // Emit regular content response if present, even when tool_calls exist
    if (data.message?.content) {
      yield { type: 'content', text: data.message.content }
    }

    // Check if the model wants to use tools
    if (data.message?.tool_calls && data.message.tool_calls.length > 0) {
      // Emit tool_start events for each tool call
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
