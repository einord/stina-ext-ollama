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
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * Ollama chat API response
 */
export interface OllamaChatResponse {
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
