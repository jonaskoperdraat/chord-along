---
name: testing-stack
description: Vitest test stack, config, file locations, and conventions for chord-along frontend
metadata:
  type: project
---

## Stack

- **Test runner:** Vitest v4 (`npm test` → `vitest run`, `npm run test:watch` → `vitest`)
- **Component testing:** `@vue/test-utils` v2
- **DOM environment:** `happy-dom` (configured via `vitest.config.ts`)
- **Coverage:** `@vitest/coverage-v8` installed (not yet wired into a script)

## Config

`vitest.config.ts` at `frontend/vitest.config.ts`:
- `environment: 'happy-dom'`
- `globals: true`
- `include: ['src/**/*.{test,spec}.ts']`
- Uses `@vitejs/plugin-vue` so Vue SFCs are transformed correctly

## File locations

Tests live in `frontend/src/__tests__/`. Pattern: `<ModuleName>.test.ts`.

## Import style

Use named imports from `vitest`: `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'`

## Always restore mocks

Each test file should call `vi.restoreAllMocks()` in `beforeEach` and `afterEach` to prevent mock bleed between tests.
