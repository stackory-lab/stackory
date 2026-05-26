# Stackory

Shared TypeScript packages for Stackory applications: backend service wiring,
auth flows, analytics/signals, storage, utilities, and agent-context tooling.

This repository is a pnpm workspace. Most package-level usage details live in
each package README.

## Packages

### Backend

- [`@stackory/backend-platform`](packages/backend/platform/README.md) - backend
  service interfaces such as logging, KV, object storage, queues, monitoring,
  and service-to-service calls.
- [`@stackory/backend-utils`](packages/backend/utils/README.md) - response
  helpers, internal request signing, HMAC verification, and timing utilities.
- [`@stackory/backend-hono`](packages/backend/hono/README.md) - Hono middleware
  and typed internal RPC helpers.
- [`@stackory/backend-platform-cloudflare`](packages/backend/platform-cloudflare/README.md)
  - Cloudflare Workers adapters for platform services.

### Auth

- [`@stackory/auth-core`](packages/auth/core/README.md) - framework-neutral
  OAuth 2.0 PKCE, token lifecycle, and device-flow primitives.
- [`@stackory/auth-better-auth`](packages/auth/better-auth/README.md) - Better
  Auth client helpers and server plugins.

### Signals

- [`@stackory/signals-core`](packages/signals/core/README.md) - framework-neutral
  user signals, analytics client, and experiment helpers.
- [`@stackory/signals-posthog`](packages/signals/posthog/README.md) - PostHog
  web and node analytics providers.

### Foundation

- [`@stackory/contracts`](packages/contracts/README.md) - shared contracts such
  as `IStorage<T>`.
- [`@stackory/storage`](packages/storage/README.md) - memory, web, and node file
  storage adapters.
- [`@stackory/constants`](packages/constants/README.md) - standard error codes
  and error classes.
- [`@stackory/utils`](packages/utils/README.md) - API client, crypto, gzip, and
  common utility helpers.

### Tooling

- [`@stackory/monosync`](packages/monosync/README.md) - synchronizes workspace
  dependency versions from `monosync.json`.
- [`@stackory/sync-agent-context`](packages/sync-agent-context/README.md) -
  generates agent context files such as `AGENTS.md`, `CLAUDE.md`, and
  `GEMINI.md` from shared Markdown fragments.

### Infra Packages

- [`@infra/dep-presets`](infra/dep-presets/README.md)
- [`@infra/tsconfig-presets`](infra/tsconfig-presets/README.md)
- [`@infra/types`](infra/types/README.md)

## Skills

Consumer-facing Codex/Claude Code skills live in the
[`stackory-skills`](stackory-skills/README.md) submodule.

