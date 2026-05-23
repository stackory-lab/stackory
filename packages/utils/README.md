# @common/core-utils

Utility functions for cryptography (HMAC, SHA256, token signing), HTTP client creation with hooks, Hono RPC response handling, path validation, and gzip compression. Uses Web Standard APIs — works in browsers, Node.js 18+, and Cloudflare Workers.

---

## Rules & Guardrails

- Never import `node:crypto` or Node-specific APIs — all crypto MUST use `crypto.subtle` (Web Crypto API).
- Never call `fetch` directly in application code — use `createApiClient()` so hooks (auth injection, tracing) are applied.
- Never add logic for a specific runtime (Node-only, browser-only) to this package — keep it universal.
- Do NOT add a new top-level export without also checking whether a subpath export is more appropriate.
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
- Dual-mode output: ESM + CJS with `.d.ts`.
- Subpath export: `@common/core-utils/types` for `IRequestResult<T>`.
- Workspace dependency: `@common/core-constants` (uses `NetworkError`).

---

## Architecture Notes

- **Runtime**: Universal — requires `crypto.subtle`, `fetch`, `Response`, `CompressionStream` (all available in browsers, Node 18+, Cloudflare Workers).
- **No Node-only APIs** — do not add `node:*` imports.

---

## Public API

```typescript
import { cryptoUtils, gzip, ApiError, createApiClient, isSafePathSegment } from '@common/core-utils'
import type { IRequestResult } from '@common/core-utils/types'

// --- Crypto ---
cryptoUtils.sha256Hex(data: string | Uint8Array | ArrayBuffer): Promise<string>
cryptoUtils.hmac(secret, parts, separator?): Promise<string>          // HMAC-SHA256 hex
cryptoUtils.hmacRaw(secret, parts, separator?): Promise<Uint8Array>   // HMAC-SHA256 bytes
cryptoUtils.timingSafeEqual(a: string, b: string): boolean
cryptoUtils.signHmacToken(payload: object, secret: string, ttlSeconds: number): Promise<string>
cryptoUtils.verifyHmacToken<T>(token: string, secret: string): Promise<T & { exp?: number }>
cryptoUtils.hex(data: ArrayBuffer | Uint8Array): string

// --- Compression ---
gzip.gzipText(text: string): Promise<Uint8Array>
gzip.gunzipText(buffer: ArrayBuffer): Promise<string>

// Throws NetworkError on transport failure on business error

createApiClient(options?: {
  baseUrl?: string
  hooks?: {
    beforeRequest?: Array<(req: Request) => Request | void>
    afterResponse?: Array<(res: Response) => Response | void>
  }
}): (input: Request | string | URL, init?: RequestInit) => Promise<T>

class ApiError extends Error {
  status: number
  data: unknown
}

// IRequestResult shape:
interface IRequestResult<T> {
  code: number
  message: string
  data: T
}

// --- Path validation ---
isSafePathSegment(value: string): boolean
// Returns false if value contains /, \, %2f, %5c, or ..
```

---

## Coding Style

- Language: TypeScript strict. Prefer `async/await`.
- Formatting: Biome, 2-space indentation, single quotes, trailing commas.
- File/folder naming: kebab-case.
- Interfaces and types: MUST prefix with `I`. Avoid `any`; prefer `unknown`.
- Return types: prefer inference; only annotate for public API functions.
- Require curly braces for all control statements.
- Tests: co-locate as `*.test.ts`; use Vitest. No network fixtures.

---

## Examples & Patterns


### Creating an authenticated API client
```typescript
import { createApiClient } from '@common/core-utils'

const client = createApiClient({
  baseUrl: 'https://api.example.com',
  hooks: {
    beforeRequest: [(req) => {
      req.headers.set('Authorization', `Bearer ${token}`)
    }],
  },
})
const data = await client<MyType>('/api/rooms')
```

### Signing and verifying a token
```typescript
import { cryptoUtils } from '@common/core-utils'

const token = await cryptoUtils.signHmacToken({ userId: '123' }, secret, 3600)
const payload = await cryptoUtils.verifyHmacToken<{ userId: string }>(token, secret)
```
