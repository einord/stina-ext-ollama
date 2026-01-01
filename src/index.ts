/**
 * Ollama AI Provider Extension for Stina
 *
 * Connects Stina to a local Ollama instance for private, offline AI conversations.
 *
 * @module stina-ext-ollama
 */

import { initializeExtension, type ExtensionContext, type Disposable } from '@stina/extension-api/runtime'

import { createOllamaProvider } from './provider.js'

/**
 * Extension activation
 *
 * Called when the extension is loaded by Stina.
 */
function activate(context: ExtensionContext): Disposable {
  context.log.info('Activating Ollama provider extension')

  const provider = createOllamaProvider(context)
  const disposable = context.providers!.register(provider)

  context.log.info('Ollama provider registered successfully')

  return disposable
}

/**
 * Extension deactivation
 *
 * Called when the extension is unloaded.
 * Cleanup is handled by the disposable returned from activate.
 */
function deactivate(): void {
  // Cleanup is handled by the disposable returned from activate
}

// Initialize the extension runtime
initializeExtension({ activate, deactivate })
