# @stackory/backend-platform-cloudflare

Cloudflare Workers implementations of the `@common/backend-platform` interfaces (KV, R2, Service Bindings, Sentry).

## Rules & Guardrails

- Do NOT import this package in Node.js services or client bundles — it depends on `@cloudflare/workers-types` and Cloudflare globals.
- Do NOT add non-Cloudflare runtime dependencies; each implementation class MUST only use Cloudflare APIs or `@sentry/cloudflare`.
- Always wrap Cloudflare natives (`KVNamespace`, `R2Bucket`, `Fetcher`) in the corresponding class rather than using them directly in application code.
- `SentryCloudflareMonitoring.wrapApp()` MUST be the outermost layer of the Hono app — call it after all middleware is registered.

## Core Project Context

- Package: `@common/backend-platform-cloudflare`
- Role: **Cloudflare implementation layer** — concrete classes that satisfy `@common/backend-platform` contracts using Cloudflare Workers primitives.
- Primary commands:
  - Type check: `pnpm --filter @common/backend-platform-cloudflare check:type`
  - Lint: `pnpm --filter @common/backend-platform-cloudflare check:lint`

## Architecture Notes

- **Dependency direction**: `@common/backend-platform-cloudflare` → `@common/backend-platform` + `@common/backend-utils`. Never reversed.
- **Entry point**: use `createCloudflarePlatformServices()` to assemble all services from Cloudflare bindings in one call; avoid constructing individual classes outside of tests.
- **Service Bindings transport**: `createCloudflareFetcherTransport()` requires the raw `env` object (or a subset `Record<string, Fetcher>`). Missing bindings throw at call time, not at construction.
- **Timing chaos**: when `AGT_TIMING_CHAOS=1`, `createSignedDOCaller()`, `createCloudflareFetcherTransport()`, and `CloudflareQueueProducer` inject local-only delays before outbound DO, Service Binding, and Queue calls to simulate Cloudflare scheduling variance.
- **R2 cursor**: `list()` sets `cursor: undefined` when `truncated === false`. Do not reuse a cursor from a completed listing.
- **Sentry**: `wrapApp()` is a no-op when `config.enabled === false`. Explicitly pass `enabled: false` in non-production environments to avoid accidental reporting.
- **Queue producer**: pass raw Cloudflare `Queue<TMessage>` bindings under `options.queue` to `createCloudflarePlatformServices()`; they are wrapped into `CloudflareQueueProducer` instances automatically. Use `CloudflareQueueBatch` in the Worker's `queue()` handler to adapt Cloudflare's `MessageBatch` to `IQueueBatch`.
- **Queue consumer**: `CloudflareQueueBatch` is a one-time adapter — construct it inside the `queue()` handler and do not hold references across requests.

## Public API

| Symbol | Kind | Description |
|--------|------|-------------|
| `createCloudflarePlatformServices(options?)` | function | Factory: wraps Cloudflare bindings into `IPlatformServices` |
| `CloudflareKVStore` | class | `IKVStore` backed by `KVNamespace` |
| `CloudflareR2Storage` | class | `IObjectStorage` backed by `R2Bucket` |
| `createCloudflareFetcherTransport(bindings)` | function | `IServiceTransport` via Cloudflare Service Bindings |
| `SentryCloudflareMonitoring` | class | `IMonitoring` via `@sentry/cloudflare` |
| `CloudflareQueueProducer<TMessage>` | class | `IQueueProducer` backed by Cloudflare `Queue` binding |
| `CloudflareQueueBatch<TMessage>` | class | `IQueueBatch` adapter for Cloudflare `MessageBatch` — use in `queue()` handler |

## Examples & Patterns

### Wiring platform services in a Cloudflare Worker

```ts
import { createCloudflarePlatformServices } from '@stackory/backend-platform-cloudflare';
import { SentryCloudflareMonitoring } from '@stackory/backend-platform-cloudflare';

export default {
  fetch(request: Request, env: Env) {
    const monitoring = new SentryCloudflareMonitoring();
    const platform = createCloudflarePlatformServices({
      kv: { sessions: env.SESSIONS_KV },
      storage: { assets: env.ASSETS_BUCKET },
      monitoring,
    });

    const app = buildApp(platform);
    return monitoring.wrapApp(app, {
      dsn: env.SENTRY_DSN,
      environment: env.ENVIRONMENT,
    }).fetch(request, env);
  },
};
```

### Wiring queue producers and consuming messages

```ts
import { createCloudflarePlatformServices, CloudflareQueueBatch } from '@stackory/backend-platform-cloudflare';

// Producer — register Queue bindings in createCloudflarePlatformServices
export default {
  fetch(request: Request, env: Env) {
    const platform = createCloudflarePlatformServices({
      queue: { jobs: env.JOBS_QUEUE },
    });
    // platform.queue.jobs is a CloudflareQueueProducer<unknown>
    const app = buildApp(platform);
    return app.fetch(request, env);
  },

  // Consumer — adapt Cloudflare's MessageBatch to IQueueBatch
  async queue(batch: MessageBatch<JobMessage>, env: Env) {
    const queueBatch = new CloudflareQueueBatch(batch);
    for (const msg of queueBatch.messages) {
      try {
        await processJob(msg.body);
        msg.ack();
      } catch {
        msg.retry({ delaySeconds: 60 });
      }
    }
  },
};
```

### Using CloudflareKVStore standalone (e.g. in tests)

```ts
import { CloudflareKVStore } from '@stackory/backend-platform-cloudflare';

const store = new CloudflareKVStore(env.MY_KV);
const value = await store.get<MyType>('key', 'json');
```
