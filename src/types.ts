/**
 * Ollama API Types
 *
 * Type definitions for Ollama API requests and responses.
 */

/**
 * Ollama API response for listing available models
 */
export interface OllamaTagsResponse {
  models: OllamaModel[]
}

/**
 * Ollama model information
 */
export interface OllamaModel {
  name: string
  model: string
  modified_at: string
  size: number
  digest: string
  details?: OllamaModelDetails
}

/**
 * Detailed model information
 */
export interface OllamaModelDetails {
  parent_model?: string
  format?: string
  family?: string
  families?: string[]
  parameter_size?: string
  quantization_level?: string
}

/**
 * Ollama chat message format
 */
export interface OllamaChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  /** Tool calls made by the model. Typically present only in assistant role messages. */
  tool_calls?: OllamaToolCall[]
}

/**
 * Ollama tool call
 */
export interface OllamaToolCall {
  function: {
    name: string
    arguments: Record<string, unknown>
  }
}

/**
 * Ollama tool definition
 */
export interface OllamaTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters?: Record<string, unknown>
  }
}

/**
 * Ollama chat API response
 */
export interface OllamaChatResponse {
  model: string
  created_at: string
  message: OllamaChatMessageResponse
  done: boolean
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

/**
 * Response message format (may include tool_calls)
 */
export interface OllamaChatMessageResponse {
  role: 'assistant'
  content: string
  tool_calls?: OllamaToolCall[]
}
