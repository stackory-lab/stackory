# @common/core-storage

Pluggable storage implementations that satisfy the `IStorage<T>` contract from `@common/core-port`. Three subpath exports for different runtimes: in-memory (universal), browser (localStorage/sessionStorage), and Node.js (file-based JSON).

---

## Rules & Guardrails

- Never import `@common/core-storage/web` in Node.js/Cloudflare Workers code — it requires `globalThis.localStorage`.
- Never import `@common/core-storage/node` in browser or edge code — it requires `node:fs` and `node:path`.
- `@common/core-storage/memory` is the only subpath safe for all runtimes.
- Do NOT add a storage backend to this package that depends on a specific database (SQLite, Redis, etc.) — use the `IStorage<T>` interface in the consuming package and implement locally.
- Ask before adding a new subpath export — it requires new tsconfig, new build entry, and package.json exports update.
- Run `pnpm run check:type && pnpm run check:lint` before declaring changes complete.

---

## Core Project Context

- Part of the Nx + pnpm monorepo at repo root. Internal deps use `workspace:*`.
- Primary commands:
  - Build: `pnpm run build` (emits three entry points to `dist/esm/` and `dist/cjs/`)
  - Type check: `pnpm run check:type`
  - Lint: `pnpm run check:lint`
  - Dependency graph: `pnpm run check:dep`
  - Clean: `pnpm run clean`
- Dual-mode output (ESM + CJS) for all three subpaths, each with `.d.ts`.
- Workspace dependency: `@common/core-port` (implements `IStorage<T>`).

---

## Architecture Notes

- **Three separate entry points**, each with its own tsconfig and build output:
  - `@common/core-storage/memory` → `dist/{esm,cjs}/memory.js` — universal
  - `@common/core-storage/web` → `dist/{esm,cjs}/web/index.js` — browser-only
  - `@common/core-storage/node` → `dist/{esm,cjs}/node/index.js` — Node-only
- **No default/main export** — always import from a subpath.
- All implementations are synchronous (matching `IStorage<T>` contract).
- Web storage handles JSON serialization and parse errors internally.
- Node file storage auto-creates parent directories on first write.

---

## Public API

```typescript
// Universal — safe in any runtime
import { createMemoryStorage } from '@common/core-storage/memory'
const store = createMemoryStorage<MyType>()
// Data is lost when the process/tab ends

// Browser-only
import { createLocalStorage, createSessionStorage } from '@common/core-storage/web'
const store = createLocalStorage<MyType>({ prefix: 'myapp' })
const sessionStore = createSessionStorage<MyType>({ prefix: 'myapp' })

// Node.js-only
import { createFileStorage } from '@common/core-storage/node'
const store = createFileStorage<MyType>('/home/user/.myapp/config.json')
// Reads/writes JSON to disk; directory is auto-created

// All implement IStorage<T>:
store.get(key: string): T | null
store.set(key: string, value: T): void
store.remove(key: string): void
store.clear(): void
store.getAllKeys(): string[]
```

---

## Coding Style

- Language: TypeScript strict.
- File/folder naming: kebab-case.
- Interfaces: MUST prefix with `I`. Avoid `any`; use generics.
- Return types: prefer inference.
- Require curly braces for all control statements.
- Tests: co-locate as `*.test.ts`; use Vitest. No network fixtures; no real FS in tests (mock or use memory storage).

---

## Examples & Patterns

### Token storage in agt-web (browser)
```typescript
import { createLocalStorage, createSessionStorage } from '@common/core-storage/web'
import type { IStoredTokens, IPendingOAuthState } from '@common/auth-core'

const tokenStorage = createLocalStorage<IStoredTokens>({ prefix: 'agt' })
const pendingStorage = createSessionStorage<IPendingOAuthState>({ prefix: 'agt' })
```

### Token storage in agt-tui (Node / Bun)
```typescript
import { createFileStorage } from '@common/core-storage/node'
import type { IStoredTokens } from '@common/auth-core'

const tokenStorage = createFileStorage<IStoredTokens>(`${homedir}/.swarm/staging.config.json`)
```

### Testing with memory storage
```typescript
import { createMemoryStorage } from '@common/core-storage/memory'

const store = createMemoryStorage<{ token: string }>()
store.set('auth', { token: 'test-token' })
expect(store.get('auth')).toEqual({ token: 'test-token' })
```
