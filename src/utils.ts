/**
 * Shared utility functions for the Ollama extension.
 */

import type { LocalizedString } from '@stina/extension-api'

let toolCallCounter = 0

/**
 * Converts a LocalizedString to a plain string.
 * If the value is already a string, returns it directly (with trimming).
 * If it's a Record, returns the English value or the first available non-empty value.
 * Falls back to a default message if no non-empty value can be found.
 */
export function localizedStringToString(value: LocalizedString): string {
  const DEFAULT_LOCALIZED_FALLBACK = '[missing localized string]'

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || DEFAULT_LOCALIZED_FALLBACK
  }

  // Try English first
  const enValue = typeof value['en'] === 'string' ? value['en'].trim() : ''
  if (enValue) {
    return enValue
  }

  // Fall back to the first non-empty value in the record
  for (const candidate of Object.values(value)) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim()
      if (trimmed) {
        return trimmed
      }
    }
  }

  // As a last resort, return a clear default instead of an empty string
  return DEFAULT_LOCALIZED_FALLBACK
}

/** Simple ID generator for tool calls */
export function generateToolCallId(): string {
  toolCallCounter++
  if (toolCallCounter >= Number.MAX_SAFE_INTEGER) {
    toolCallCounter = 1
  }
  return `call_${Date.now()}_${toolCallCounter.toString(36)}`
}
