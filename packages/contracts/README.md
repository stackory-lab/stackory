# @common/core-port

Pure TypeScript interface contracts for the core library. Contains no runtime code — shipped as source only. Acts as the shared contract layer that other packages implement or depend on.

---

## Rules & Guardrails

- Never add runtime code to this package. It MUST remain type-only (interfaces, types, enums with no values).
- Never add a build step or `dist/` output — consumers import directly from `./src/index.ts` via TypeScript path resolution.
- Do NOT add dependencies on other packages here. This package is the bottom of the dependency graph.
- Ask before adding new interfaces — all additions become public contracts that consumers must implement.

---

## Core Project Context

- Part of the Nx + pnpm monorepo at repo root. Internal deps use `workspace:*`.
- No build step — entry point is `./src/index.ts`.
- Commands:
  - Type check: `pnpm run check:type`
  - Lint: `pnpm run check:lint`
  - Dependency graph: `pnpm run check:dep`
- Consumed by: `@common/core-storage`, `@common/auth-core`, and any package needing the `IStorage<T>` contract.

---

## Architecture Notes

- **Source-only distribution** — `package.json` `main` and `types` both point to `./src/index.ts`. No compilation required.
- **No runtime dependencies** — zero dependency package; bottom of the workspace dependency graph.
- **Universal** — pure interfaces compile away; no runtime constraints.

---

## Public API

```typescript
import type { IStorage } from '@common/core-port'

interface IStorage<T> {
  get: (key: string) => T | null
  set: (key: string, value: T) => void
  remove: (key: string) => void
  clear: () => void
  getAllKeys: () => string[]
}
```

**`IStorage<T>`** — Generic key/value storage contract. Implementations live in `@common/core-storage`.

---

## Coding Style

- Language: TypeScript strict. Interfaces and types only.
- File/folder naming: kebab-case.
- Interfaces: MUST prefix with `I` (e.g., `IStorage`).
- No `any`. No runtime code.
