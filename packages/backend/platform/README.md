# @stackory/backend-platform

Platform-agnostic interface definitions and service-calling utilities for backend services.

## Rules & Guardrails

- Do NOT add runtime platform dependencies (Cloudflare, Node.js APIs) to this package — it must stay zero-dependency.
- Do NOT implement platform-specific logic here; place all concrete implementations in `@common/backend-platform-cloudflare` or equivalent.
- Do NOT import this package in client-side bundles; it is server-only.
- All new storage or service interfaces MUST follow the existing naming convention: `I<Name>` prefix, method signatures using `Promise<T>`.

## Core Project Context

- Package: `@common/backend-platform`
- Role: **Abstraction layer** — defines all platform service interfaces and one portable implementation (`ConsoleLogger`, `createServiceCaller`).
- No runtime dependencies. Safe to import in any server environment.
- Primary commands:
  - Type check: `pnpm --filter @common/backend-platform check:type`
  - Lint: `pnpm --filter @common/backend-platform check:lint`

## Architecture Notes

- **Position in stack**: sits below `@common/backend-hono`, `@common/backend-utils`, and `@common/backend-platform-cloudflare`. All other backend packages depend on this.
- **Dependency rule**: this package MUST NOT depend on `@common/backend-utils` or `@common/backend-hono` (would create a circular dependency).
- **`IPlatformServices`** is the single aggregation point injected into Hono app context at startup. Always pass it as a whole rather than cherry-picking sub-interfaces.
- **`IServiceCaller`** uses `IServiceTransport` + `IRequestInterceptor[]` for extensibility. Add HMAC signing via `@common/backend-utils`' `createHmacSigningInterceptor`.
- **`IKVStore`** mirrors Cloudflare KV API semantics; new implementations must support the `'json'` type overload on `get`.
- **`IQueueProducer`** is the producer-only interface; the consumer side (`IQueueBatch` / `IQueueMessage`) is used in queue handler callbacks and is never part of `IPlatformServices`. Named producers are registered under `IPlatformServices.queue` as a `Record<string, IQueueProducer<unknown>>`.

## Public API

| Symbol | Kind | Description |
|--------|------|-------------|
| `IPlatformServices` | interface | Aggregates all injectable platform services |
| `IKVStore` / `IKVListResult` | interface | Key-value store contract |
| `ILogger` | interface | Structured logger with `child()` support |
| `ConsoleLogger` | class | JSON console logger, implements `ILogger` |
| `IMonitoring` / `IMonitoringConfig` | interface | Exception/message capture contract |
| `IObjectStorage` / `IStorageObject` / `IStorageObjectMetadata` / `IStorageListResult` | interface | Object storage (R2-shaped) contract |
| `IServiceCaller` / `IServiceCallerOptions` | interface | Service-to-service call contract |
| `createServiceCaller(transport, interceptors?)` | function | Builds an `IServiceCaller` from a transport and optional interceptor chain |
| `createServiceCallerFetch(caller, serviceName)` | function | Wraps `IServiceCaller` into a standard `fetch`-compatible function |
| `IRequestInterceptor` | interface | Middleware hook for mutating outbound requests |
| `IServiceTransport` | interface | Low-level fetch-to-service abstraction |
| `IQueueProducer<TMessage>` | interface | Queue producer contract — `send` / `sendBatch` with optional delay |
| `IQueueMessage<TMessage>` | interface | Single queued message with `ack()` and `retry()` lifecycle hooks |
| `IQueueBatch<TMessage>` | interface | Batch of messages with `ackAll()` / `retryAll()` convenience methods |
| `IQueueSendOptions` / `IQueueRetryOptions` | interface | Options for sending and retrying messages (`delaySeconds`) |

## Examples & Patterns

### Composing a service caller with HMAC signing

```ts
import { createServiceCaller } from '@stackory/backend-platform';
import { createHmacSigningInterceptor } from '@stackory/backend-utils';
import { createCloudflareFetcherTransport } from '@stackory/backend-platform-cloudflare';

const transport = createCloudflareFetcherTransport(env); // env contains Cloudflare Fetcher bindings
const caller = createServiceCaller(transport, [
  createHmacSigningInterceptor(() => Promise.resolve(env.INTERNAL_SECRET)),
]);
```

### Sending messages via IQueueProducer

```ts
import type { IQueueProducer } from '@stackory/backend-platform';

async function enqueueJob(queue: IQueueProducer<{ userId: string }>, userId: string) {
  await queue.send({ userId }, { delaySeconds: 5 });
}

// Send multiple messages in one call
await queue.sendBatch([{ userId: 'a' }, { userId: 'b' }]);
```

### Consuming messages with IQueueBatch

```ts
import type { IQueueBatch } from '@stackory/backend-platform';

async function handleBatch(batch: IQueueBatch<{ userId: string }>) {
  for (const msg of batch.messages) {
    try {
      await processUser(msg.body.userId);
      msg.ack();
    } catch {
      msg.retry({ delaySeconds: 30 });
    }
  }
}
```

### Implementing a custom ILogger

```ts
import type { ILogger } from '@stackory/backend-platform';

export class MyLogger implements ILogger {
  child(bindings: Record<string, unknown>): ILogger { ... }
  info(message: string, context?: Record<string, unknown>): void { ... }
  warn(message: string, context?: Record<string, unknown>): void { ... }
  error(message: string, context?: Record<string, unknown>): void { ... }
  debug(message: string, context?: Record<string, unknown>): void { ... }
}
```
