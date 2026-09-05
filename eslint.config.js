// Single ESLint config for the whole monorepo (docs/backend-conventions.md
// "Tooling") — one toolchain for backend, frontend, and packages/*, instead
// of a different linter per package.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  {
    // .claude/worktrees/** holds separate git worktrees Claude Code creates for
    // isolated background/subagent tasks — each is its own checkout with its
    // own tsconfig, so scanning them from the root config hits ambiguous
    // tsconfigRootDir parsing errors whenever one is active alongside `eslint .`.
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/.firebase/**', '.claude/worktrees/**']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Backend + shared-types: Node globals, no React.
    files: ['backend/**/*.ts', 'packages/*/src/**/*.ts'],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    // Frontend: browser globals + React hooks / Fast Refresh rules.
    files: ['frontend/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
    }
  },
  {
    // Test files everywhere: vitest/testing-library globals, relax a couple
    // of rules that are noisy in test fixtures (any-typed mock data, etc.).
    files: ['**/test/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },
  {
    // Raw TMDB JSON responses — modeling their whole API surface for a few
    // parsing call sites isn't worth it; `any` here is a deliberate boundary,
    // not an oversight.
    files: ['backend/src/lib/tmdb.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    // react-hooks v7's set-state-in-effect rule flags plenty of idiomatic,
    // already-tested effect patterns in this codebase (e.g. "reset state and
    // return early when a dependency goes away") — kept as a warning rather
    // than disabled outright, so new code is still nudged away from it.
    files: ['frontend/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/set-state-in-effect': 'warn'
    }
  },
  prettierConfig
)
