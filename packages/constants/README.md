# @stackory/core-constants

Standardized error codes, error classes, and common error definitions for the entire monorepo. Implements a 7-digit hierarchical error code system (`A-BB-CCC`): `A` = layer (1=auth, 2=infra), `BB` = category, `CCC` = specific code.

---

## Rules & Guardrails

- Never define error codes outside this package — all new error codes MUST be added here.
- Never change existing error code numeric values — they may be persisted in logs or returned to clients.
- Do NOT add any runtime logic beyond error class constructors.
- Ask before adding new error code ranges — coordinate with the owning layer (auth vs infra vs biz).
- Run `pnpm run check:type && pnpm run check:lint` before declaring changes complete.

---

## Core Project Context

- Part of the Nx + pnpm monorepo at repo root. Internal deps use `workspace:*`.
- Primary commands:
  - Build: `pnpm run build` (emits to `dist/esm/` and `dist/cjs/`)
  - Type check: `pnpm run check:type`
  - Lint: `pnpm run check:lint`
  - Dependency graph: `pnpm run check:dep`
  - Clean: `pnpm run clean`
- Dual-mode output: ESM (`dist/esm/`) + CJS (`dist/cjs/`), each with `.d.ts` declarations.
- No dependencies on other workspace packages.

---

## Architecture Notes

- **Runtime**: Universal — no browser or Node APIs used.
- **No workspace dependencies** — bottom of the error/constant graph.
- **Single export** (`error`) — no subpath exports.

---

## Public API

```typescript
import { error } from '@stackory/core-constants'

// Error codes (numeric constants)
error.errorCode.INVALID_ARGUMENT         // 100400
error.errorCode.UNAUTHORIZED             // 100401
error.errorCode.PERMISSION_DENIED        // 100403
error.errorCode.RATE_LIMIT_EXCEEDED      // 100429
error.errorCode.INTERNAL_SERVER_ERROR    // 200500
error.errorCode.SERVICE_UNAVAILABLE      // 200503
error.errorCode.AUTH_INTERNAL_MISSING    // 101001
error.errorCode.AUTH_INTERNAL_EXPIRED    // 101002
error.errorCode.AUTH_INTERNAL_SIG_ERROR  // 101003
error.errorCode.AUTH_USER_ID_MISSING     // 101004
error.errorCode.AUTH_BEARER_ERROR        // 101005
error.errorCode.AUTH_CONNECT_TOKEN_ERROR // 101006

// Error classes
error.StandardError   // Base: { code: number, message: string, data?: unknown }
error.NetworkError    // Extends StandardError — transport-level failures
```

**Error code scheme:**
- `1xx-xxx` — Auth layer
- `2xx-xxx` — Infrastructure layer
- `xxx-4xx` — Client errors
- `xxx-5xx` — Server errors
- `xxx-0xx` — Internal/domain-specific codes

---

## Coding Style

- Language: TypeScript strict.
- File/folder naming: kebab-case.
- Interfaces: MUST prefix with `I`. Avoid `any`.
- New error classes MUST extend `StandardError`.
- Require curly braces for all control statements.
