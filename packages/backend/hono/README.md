# @stackory/backend-hono

Hono middleware collection plus internal RPC client helpers: error handling, HMAC-based internal auth, request logging, user identity extraction, and typed `hono/client` adapters for worker-to-worker calls.

## Rules & Guardrails

- Do NOT register `errorHandlerMiddleware` anywhere other than as the top-level Hono `app.onError` handler — duplicate registration causes double-serialisation.
- `createInternalAuthMiddleware` and `createHmacSigningInterceptor` (`@common/backend-utils`) are a matched pair; never change the signing algorithm on one side without updating the other.
- Do NOT use `userIdMiddleware` on public routes — it throws `AUTH_USER_ID_MISSING` when `X-User-Id` header is absent.
- `createRequestLoggerMiddleware` MUST be registered before route handlers so the child logger is available in context.
- Do NOT import Node.js APIs in this package; it must remain edge-compatible.

## Core Project Context

- Package: `@common/backend-hono`
- Role: **Framework layer** — Hono-specific middleware built on top of `@common/backend-utils` and `@common/core-utils`.
- Primary commands:
  - Type check: `pnpm --filter @common/backend-hono check:type`
  - Lint: `pnpm --filter @common/backend-hono check:lint`

## Architecture Notes

- **Error handling**: `errorHandlerMiddleware` catches all thrown errors. If the error is a `StandardError` (from `@common/core-utils`), it extracts `code` and `message`; otherwise returns `INTERNAL_SERVER_ERROR`. Response shape is always `IRequestResult`.
- **Internal auth**: `createInternalAuthMiddleware` validates `X-Internal-Signature` and `X-Internal-Timestamp` headers. Replay attack window defaults to 60 s. Use `ignorePaths` (regex array) to exclude health-check or public endpoints.
  - Signature verification uses time-safe comparison — do NOT replace with `===`.
  - Body signing is skipped for `multipart/form-data` and `application/octet-stream`; middleware checks `X-Internal-Skip-Body: true` header in that case.
- **Internal RPC client**: `createInternalRpcClient()` bridges `@common/backend-platform`'s `IServiceCaller` into a typed `hono/client` instance. Keep this helper generic: it should own Hono client integration, request header injection, and response parsing, but must not hardcode service bindings, route prefixes, or business headers.
- **Request logging**: `createRequestLoggerMiddleware` attaches a `child` logger (with `traceId`, `method`, `path`) to context. Log level is determined by response status: `500+` → `error`, `400+` → `warn`, otherwise `info`.
- **User identity**: `userIdMiddleware` reads `X-User-Id` header and stores the value in Hono context. Pair with `createInternalAuthMiddleware` to ensure the header is trustworthy.

## Public API

| Symbol | Kind | Description |
|--------|------|-------------|
| `errorHandlerMiddleware` | `ErrorHandler` | Hono `app.onError` handler; normalises all errors to `IRequestResult` |
| `createInternalAuthMiddleware<E>(options)` | function | HMAC auth middleware; validates signature + timestamp |
| `createInternalRpcClient<TRpcClient>(options)` | function | Builds a typed `hono/client` instance over an `IServiceCaller` |
| `InternalRpcError` | class | Error thrown by `createInternalRpcClient` for non-2xx responses |
| `IUnwrapHonoRpcClient<T>` | type | Recursively unwraps Hono client methods from `Response` to parsed payloads |
| `InternalAuthOptions<E>` | interface | Options for `createInternalAuthMiddleware` |
| `createRequestLoggerMiddleware<E>(options)` | function | Attaches a child logger to each request context |
| `userIdMiddleware` | `MiddlewareHandler` | Extracts `X-User-Id` header into context; throws on missing header |

## Examples & Patterns

### Minimal Hono app setup

```ts
import { Hono } from 'hono';
import {
  errorHandlerMiddleware,
  createInternalAuthMiddleware,
  createRequestLoggerMiddleware,
} from '@stackory/backend-hono';
import { ConsoleLogger } from '@stackory/backend-platform';

const logger = new ConsoleLogger();
const app = new Hono<{ Variables: { logger: IRequestLogger } }>();

app.onError(errorHandlerMiddleware);

app.use('*', createRequestLoggerMiddleware({
  getLogger: (c) => c.get('logger'),
  setLogger: (c, l) => c.set('logger', l),
}));

app.use('/internal/*', createInternalAuthMiddleware({
  getSecret: (c) => c.env.INTERNAL_SECRET,
  maxTimeDiff: 30,           // seconds; optional, default 60
  ignorePaths: [/\/health$/],
}));
```

### Using userIdMiddleware on authenticated routes

```ts
import { userIdMiddleware } from '@stackory/backend-hono';

app.use('/api/*', userIdMiddleware);

app.get('/api/profile', (c) => {
  const userId = c.get('userId'); // set by middleware
  ...
});
```
