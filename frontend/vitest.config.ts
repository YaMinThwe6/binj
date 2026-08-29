import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./test/setup.ts'],
      globals: true,
      // Default 5000ms is too tight once backend+frontend suites run concurrently
      // (pre-commit hook's `pnpm test` does exactly that) — several unrelated,
      // otherwise-passing tests were timing out purely from machine contention,
      // not from any real regression (each passed cleanly re-run in isolation).
      testTimeout: 15000,
    },
  })
)
