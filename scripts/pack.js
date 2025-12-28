#!/usr/bin/env node

/**
 * Pack the extension for distribution
 *
 * Creates a zip file containing:
 * - manifest.json
 * - dist/index.js
 * - README.md
 */

import { createWriteStream, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

// Read manifest for version
const manifest = JSON.parse(readFileSync(join(rootDir, 'manifest.json'), 'utf-8'))
const outputName = `${manifest.id}-${manifest.version}.zip`

// Check if dist exists
if (!existsSync(join(rootDir, 'dist', 'index.js'))) {
  console.error('Error: dist/index.js not found. Run "pnpm build" first.')
  process.exit(1)
}

// Create zip using system zip command
try {
  execSync(`zip -j ${outputName} manifest.json dist/index.js README.md`, {
    cwd: rootDir,
    stdio: 'inherit',
  })
  console.log(`\nCreated: ${outputName}`)
  console.log('Upload this file to GitHub Releases.')
} catch (error) {
  console.error('Failed to create zip:', error.message)
  process.exit(1)
}
