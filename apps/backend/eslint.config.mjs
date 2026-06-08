// Flat ESLint config for the Hono/Node backend.
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'api/**',
      'dev/**',
      'coverage/**',
      'src/generated/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Pragmatic defaults for a large existing codebase; tighten over time.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/no-empty-object-type': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-constant-condition': ['error', { checkLoops: false }],
      // Allow `@ts-nocheck` on the documented legacy procurement/inventory files
      // (see docs/TECH_DEBT.md); keep `@ts-ignore` discouraged.
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-nocheck': false, 'ts-ignore': 'allow-with-description', 'ts-expect-error': 'allow-with-description' },
      ],
    },
  },
)
