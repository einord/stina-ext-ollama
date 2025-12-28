import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  // Bundle everything into a single file for the extension
  noExternal: [/.*/],
  // Except the extension-api which will be provided by the host
  external: ['@stina/extension-api', '@stina/extension-api/runtime'],
})
