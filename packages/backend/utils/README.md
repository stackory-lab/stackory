# @stackory/backend-utils

Shared backend utilities: unified HTTP response format, HMAC signature computation, timing-chaos helpers, and the signing interceptor for internal service calls.

## Rules & Guardrails

- Do NOT use `errorResponse` / `successResponse` directly in Hono route handlers — wrap them via `@common/backend-hono`'s `errorHandlerMiddleware` for consistent error propagation.
- Do NOT modify the HMAC signing algorithm (`computeInternalSignature`) without updating `createInternalAuthMiddleware` in `@common/backend-hono` simultaneously — they are a matched pair.
- `SIGNATURE_SKIP_BODY_PAYLOAD` is a sentinel constant; never use it as a real request body.
- This package targets both ESM and CJS; do NOT use top-level `await` or ESM-only syntax.

## Core Project Context

- Package: `@common/backend-utils`
- Role: **Utility layer** — response wrappers, HMAC signing helpers, and the `IRequestInterceptor` implementation for internal auth.
- Dual-format: ships ESM (`dist/esm/`) and CJS (`dist/cjs/`).
- Primary commands:
  - Type check: `pnpm --filter @common/backend-utils check:type`
  - Lint: `pnpm --filter @common/backend-utils check:lint`

## Architecture Notes

- **HMAC flow**: `createHmacSigningInterceptor` (this package) is the client side; `createInternalAuthMiddleware` (`@common/backend-hono`) is the server side. Both use `computeInternalSignature` with the same four-part message: `[METHOD, PATH+QUERY, TIMESTAMP, BODY]`.
- **Body skipping**: requests with `multipart/form-data` or `application/octet-stream` content types use `SIGNATURE_SKIP_BODY_PAYLOAD` as the body component. The server middleware recognises the `X-Internal-Skip-Body: true` header to apply the same bypass.
- **`IRequestResult<T>`**: the canonical response envelope. `code: 0` = success, any non-zero `code` = error. `data` is always `null` on error responses.
- **`createServiceCallerFetch`** (in `@common/backend-platform`) plus `createHmacSigningInterceptor` (here) is the standard pattern for service-to-service authenticated calls.

## Public API

| Symbol | Kind | Description |
|--------|------|-------------|
| `IRequestResult<T>` | interface | `{ code, message, data }` response envelope |
| `successResponse<T>(data)` | function | Wraps data in `{ code: 0, message: 'success', data }` |
| `errorResponse(codeOrMsg?, message?)` | function | Returns `{ code, message, data: null }` |
| `computeInternalSignature(params)` | function | Async HMAC-SHA256 over `[method, path, timestamp, body]` |
| `SIGNATURE_SKIP_BODY_PAYLOAD` | constant | Sentinel string used when body signing is skipped |
| `createHmacSigningInterceptor(getSecret)` | function | `IRequestInterceptor` that adds `X-Internal-Signature` and `X-Internal-Timestamp` headers |
| `timingChaosDelay(label, options?)` | function | Local-only delay injection enabled by `AGT_TIMING_CHAOS=1` |
| `getTimingChaosDelayMs(label, options?)` | function | Returns a chaos delay for timer-based call sites, or `null` when disabled |

## Examples & Patterns

### Wrapping route results

```ts
import { successResponse, errorResponse } from '@stackory/backend-utils';

// Success
return c.json(successResponse({ userId: '123' }));

// Error with code
return c.json(errorResponse(1001, 'User not found'), 404);

// Error with message only
return c.json(errorResponse('Validation failed'), 400);
```

### Adding HMAC signing to a service caller

```ts
import { createServiceCaller } from '@stackory/backend-platform';
import { createHmacSigningInterceptor } from '@stackory/backend-utils';

const caller = createServiceCaller(transport, [
  createHmacSigningInterceptor(async () => env.INTERNAL_SECRET),
]);
```

### Enabling timing chaos locally

```dotenv
AGT_TIMING_CHAOS=1
AGT_TIMING_CHAOS_MAX_MS=5000
AGT_TIMING_CHAOS_SEED=room-replay-debug
```

`AGT_TIMING_CHAOS_SEED` is optional. Set it when you want repeatable delay sequences while debugging local Cloudflare timing races.
