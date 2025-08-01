import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'types.ts',
    'z-depths.ts', 
    'socket-events.ts',
    'animal-dimensions.ts',
    'background-types.ts',
    'interaction-types.ts',
    'interaction-prompts.ts',
    'nickname-generator.ts'
  ],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  outDir: 'dist',
  splitting: false,
  sourcemap: false,
  minify: false,
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.js' : '.mjs'
    }
  }
})