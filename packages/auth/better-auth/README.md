# @stackory/auth-better-auth

Authentication bridge for Better Auth clients and the device-flow Better Auth server plugin. The package is intentionally split into subpaths so browser/TUI bundles do not import server-only Better Auth modules.

---

## Rules & Guardrails

- Import only the runtime-specific subpath you need. Browser/TUI code must use `./client`, `./client/pkce`, `./client/device`, `./client/session`, or `./config`; server plugin code must use `./server-plugins`.
- Client-side code must not import `better-auth/api`, `better-auth/plugins/*`, `src/server-plugins/**`.
- Server-side code must not import `better-auth/client`, `better-auth/react`, `src/client/**`, `src/client-plugins/**`.
- Never store tokens in plain variables or module-level singletons — always provide `tokenStorage` and `pendingStorage` implementations backed by a real storage adapter.
- Do NOT add subpath exports without updating the TypeScript build inputs and the `exports` field in `package.json`.
- Do NOT upgrade `better-auth` or `@better-auth/oauth-provider` without also checking `@common/auth-core` and all consumers (pinned to `1.6.11`).
- Run `pnpm run check:type && pnpm run check:lint` before declaring changes complete. If you could not run them, say so.

---

## Core Project Context

- Part of the Nx + pnpm monorepo at repo root. Internal deps use `workspace:*`.
- Primary commands (run from this package dir or with `--filter @common/auth-better-auth`):
  - Build: `pnpm run build` (emits to `dist/esm/` and `dist/cjs/`)
  - Type check: `pnpm run check:type`
  - Lint: `pnpm run check:lint`
  - Test: `pnpm run check:test`
  - Dependency graph: `pnpm run check:dep`
  - Clean: `pnpm run clean` (removes `dist/`, `node_modules/`)
- Dual-mode output: ESM (`dist/esm/`) + CJS (`dist/cjs/`), each with `.d.ts` declarations.
- Public subpaths (from `package.json` `exports`):
  - `./config` — shared URL helpers (`createAuthConfig`).
  - `./client` — barrel for all client-side exports (errors, device, pkce, session).
  - `./client/pkce` — PKCE setup factory (`createPkceSetup`, `IPkceSetup`).
  - `./client/device` — device flow client (`createDeviceFlowProvider`, `createDeviceLogin`, `createDeviceActions`).
  - `./client/session` — session/consent RPC wrappers (`createSessionActions`).
  - `./client-plugins` — Better Auth client plugin entries (`deviceFlowClient`).
  - `./server-plugins` — Better Auth server plugin barrel (`deviceFlowPlugin`).

---

## Architecture Notes

- **Runtime target**: Browser + Node.js 18+ for `client/**`; Better Auth server runtime for `server-plugins/**`. Shared code must stay runtime-neutral.
- **`src/shared/`** — URL helpers (`createAuthConfig`), constants (`DEVICE_FLOW_ERROR_CODES`).
- **`src/client/pkce/`** — `createPkceSetup` wires `createOAuth2TokenProvider` + `createPkceFlow` + `createTokenManager` from `@common/auth-core`. PKCE flow is cross-process (browser redirect → callback); no single runtime `run` helper.
- **`src/client/device/`** — `createDeviceFlowProvider` adapts the `deviceFlowClient()` plugin to `@common/auth-core`'s `IDeviceFlowProvider` port. `createDeviceLogin` provides the full RFC 8628 orchestration. `createDeviceActions` wraps device info/approve/deny for UI verification pages.
- **`src/client/session/`** — `createSessionActions` wraps session, social sign-in, and oauth-provider consent endpoints.
- **`src/client-plugins/`** — Better Auth client plugin entries (`deviceFlowClient`).
- **`src/server-plugins/device-flow/`** — Complete RFC 8628 server plugin for Better Auth: `deviceFlowPlugin` with `/device/code`, `/device/token`, `/device/info`, `/device/approve`, `/device/deny`, `/device/redirect` endpoints.
- **Dependency boundaries** are enforced by `.dependency-cruiser.mjs`.
- **Workspace dependencies** (never re-implement locally):
  - `@common/auth-core` — `createPkceFlow`, `createTokenManager`, `pollDeviceToken`, `IDeviceFlowProvider`, `IOAuth2TokenProvider`, `IStoredTokens`, `IPendingOAuthState`, `wireTokenResponseToStored`
  - `@common/core-port` — `IStorage<T>` generic storage port interface
- **Storage abstraction**: Consumers MUST pass concrete `IStorage<IStoredTokens>` and `IStorage<IPendingOAuthState>` implementations. The package has no opinion on where tokens are stored.

---

## Public API

```typescript
// PKCE setup (composes tokenProvider + pkceFlow + tokenManager)
import { createPkceSetup } from '@common/auth-better-auth/client/pkce'

const { pkceFlow, tokenManager, tokenProvider } = createPkceSetup({
  baseURL: 'https://api.example.com',
  basePath: '/api/auth',
  clientId: 'my-client',
  audience: 'https://api.example.com',
  scope: 'openid profile email offline_access',
  redirectURI: 'https://app.example.com/auth/callback', // or () => string
  tokenStorage,    // IStorage<IStoredTokens>
  pendingStorage,  // IStorage<IPendingOAuthState>
  onRefresh: (tokens) => { /* optional: sync refreshed tokens */ },
})

pkceFlow.prepareAuthorizationURL('/dashboard')  // Step 1: redirect
pkceFlow.exchangeCode({ code, state })          // Step 2: callback handler
tokenManager.getValidToken()                    // auto-refresh aware

// Device flow client
import { createDeviceFlowProvider, createDeviceLogin } from '@common/auth-better-auth/client/device'
import { createAuthClient } from 'better-auth/client'
import { deviceFlowClient } from '@common/auth-better-auth/client-plugins'

const authClient = createAuthClient({ baseURL, basePath, plugins: [deviceFlowClient()] })
const provider = createDeviceFlowProvider(authClient)
const login = createDeviceLogin({ provider, tokenManager, clientId, scope, resource })
await login({
  onUserPrompt: ({ userCode, verificationUri }) => { /* show to user */ },
  onVerificationUri: async (url) => { /* open browser */ },
  signal: abortController.signal,
})

// Device flow UI actions (verification page)
import { createDeviceActions } from '@common/auth-better-auth/client/device'

const deviceActions = createDeviceActions({ baseURL, basePath })
await deviceActions.getDeviceInfo({ userCode })
await deviceActions.approveDevice({ userCode })
await deviceActions.denyDevice({ userCode })

// Session / consent actions
import { createSessionActions } from '@common/auth-better-auth/client/session'

const actions = createSessionActions({ baseURL, basePath })
await actions.getSession()
await actions.signOut()
await actions.signInSocial({ provider: 'google', callbackURL: '/auth/callback' })
await actions.getOAuthClientPublic(clientId)
await actions.submitOAuthConsent({ accept: true, scope: 'openid profile' })

// Shared config
import { createAuthConfig } from '@common/auth-better-auth/config'
const config = createAuthConfig({ baseURL, basePath })
config.tokenEndpoint  // https://api.example.com/api/auth/oauth2/token

// Server plugin
import { deviceFlowPlugin } from '@common/auth-better-auth/server-plugins'

const auth = betterAuth({
  plugins: [
    deviceFlowPlugin({
      verificationUri: 'https://app.example.com/auth/device',
      codeTtlSec: 600,
      allowedClientIds: ['my-client'],
      validResources: ['https://api.example.com'],
    }),
  ],
})
```

---

## Coding Style

- Language: TypeScript strict. Prefer `async/await`.
- Formatting: Biome, 2-space indentation, single quotes, trailing commas.
- File/folder naming: kebab-case only. No camelCase or PascalCase paths.
- Interfaces and types: MUST prefix with `I` (e.g., `ICreatePkceSetupParams`). Avoid `any`; prefer `unknown`.
- Return types: prefer inference; only annotate for the exported public function signature.
- Avoid `: void` / `: Promise<void>` annotations. Handle async errors with `.catch()` or `try/catch`.
- Require curly braces for all control statements.

---

## Examples & Patterns

### Browser (agt-web) — PKCE flow
```typescript
import { createStorageAdapter } from '@common/core-storage/browser'
import { createPkceSetup } from '@common/auth-better-auth/client/pkce'

const { pkceFlow, tokenManager } = createPkceSetup({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  basePath: '/user-center/api/auth',
  clientId: import.meta.env.VITE_OAUTH_CLIENT_ID,
  audience: import.meta.env.VITE_API_AUDIENCE,
  scope: 'openid profile email offline_access',
  redirectURI: () => `${window.location.origin}/auth/callback`,
  tokenStorage: createStorageAdapter(localStorage, 'auth.tokens'),
  pendingStorage: createStorageAdapter(sessionStorage, 'auth.pending'),
})
```

### Node / Bun (agt-tui) — device flow
```typescript
import { createFileStorageAdapter } from '@common/core-storage/node'
import { createPkceSetup } from '@common/auth-better-auth/client/pkce'
import { createDeviceFlowProvider, createDeviceLogin } from '@common/auth-better-auth/client/device'
import { createAuthClient } from 'better-auth/client'
import { deviceFlowClient } from '@common/auth-better-auth/client-plugins'

const { tokenManager } = createPkceSetup({
  baseURL: config.apiBaseURL,
  basePath: '/user-center/api/auth',
  clientId: config.oauthClientId,
  audience: config.oauthAudience,
  scope: 'openid profile email offline_access',
  redirectURI: `http://localhost:${config.callbackPort}/callback`,
  tokenStorage: createFileStorageAdapter(configPath, 'tokens'),
  pendingStorage: createFileStorageAdapter(configPath, 'pending'),
})

const authClient = createAuthClient({
  baseURL: config.apiBaseURL,
  basePath: '/user-center/api/auth',
  plugins: [deviceFlowClient()],
})
const provider = createDeviceFlowProvider(authClient)
const login = createDeviceLogin({
  provider,
  tokenManager,
  clientId: config.oauthClientId,
  scope: 'openid profile email offline_access',
  resource: config.oauthAudience,
})

await login({
  onUserPrompt: ({ userCode, verificationUri }) => {
    console.log(`Open ${verificationUri} and enter: ${userCode}`)
  },
  onVerificationUri: async (url) => { await open(url) },
})
```
