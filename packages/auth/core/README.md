# @stackory/auth-core

Lightweight, universal OAuth 2.0 orchestration library with PKCE (S256) support and RFC 8628 Device Authorization Grant. Provides composable factories for the authorization code flow, device flow polling, token lifecycle management, and structured error types. Used as the foundation layer by `@common/auth-better-auth`.

---

## Rules & Guardrails

- Never import Node-specific APIs (`node:crypto`, `node:fs`). All crypto MUST use `crypto.subtle` and `crypto.randomUUID()` (Web Crypto API).
- Never hardcode scopes — `IPkceFlowConfig.scope` is required; the caller owns the choice of scopes.
- Never call the token endpoint directly from application code — always go through `IOAuth2TokenProvider` so the endpoint is swappable.
- Do NOT store tokens in plain module variables — always pass a concrete `IStorage<IStoredTokens>` implementation.
- Ask before changing `IOAuth2TokenProvider`, `IPkceFlow`, or `ITokenManager` interface shapes — they are consumed by `@common/auth-better-auth`, `apps/agt-web`, and `apps/agt-tui`.
- The `resource` / `audience` parameter is sent as the `audience` value to the token endpoint (non-standard but required by this system's auth server). Do not rename or remove it.
- Run `pnpm run check:type && pnpm run check:lint` before declaring changes complete. If you could not run them, say so.

---

## Core Project Context

- Part of the Nx + pnpm monorepo at repo root. Internal deps use `workspace:*`.
- Primary commands (run from this package dir or with `--filter @common/auth-core`):
  - Build: `pnpm run build` (emits to `dist/esm/` and `dist/cjs/`)
  - Type check: `pnpm run check:type`
  - Lint: `pnpm run check:lint`
  - Test: `pnpm run check:test`
  - Dependency graph: `pnpm run check:dep`
  - Clean: `pnpm run clean`
- Dual-mode output: ESM (`dist/esm/`) + CJS (`dist/cjs/`), each with `.d.ts` declarations.
- Single entry point — no subpath exports.
- Workspace dependency: `@common/core-port` (provides `IStorage<T>`).

---

## Architecture Notes

- **Runtime**: Universal — browser, Node.js 18+, Cloudflare Workers. Requires `crypto.subtle` and `crypto.randomUUID()`. No polyfills needed in modern environments.
- **Port-based design**: `IOAuth2TokenProvider` is a port for RFC 6749 §3.2 token endpoints. `IDeviceFlowProvider` is a port for RFC 8628 device authorization endpoints. Adapters implement these against specific servers; flow logic is decoupled from HTTP transport.
- **Storage abstraction**: Both PKCE pending state and access/refresh tokens use `IStorage<T>` from `@common/core-port`. Pass any implementation (localStorage, file, memory).
- **Token freshness**: `getValidToken()` triggers a refresh if the stored `accessTokenExpiresAt` is within 60 seconds of expiry.
- **PKCE**: S256 challenge generated automatically by `createCodeChallenge`. State and code verifier held in `pendingStorage` during the redirect round-trip, then cleared after `exchangeCode`.
- **Composability**: `createPkceFlow` composes `IOAuth2TokenProvider` + both storage adapters. `createTokenManager` composes `IOAuth2TokenProvider` + token storage. They can be used independently.
- **Device flow**: `pollDeviceToken` drives the RFC 8628 §3.5 polling state machine. Uses a monotonic clock (`now` param); `slow_down` increments interval by 5s (capped at 30s). Throws `AuthError` for all non-success exits.

---

## Public API

### Factories

```typescript
import {
  createPkceFlow,
  createTokenManager,
  createCodeChallenge,
  createRandomString,
  pollDeviceToken,
  tokenResponseToStored,
  wireTokenResponseToStored,
} from '@common/auth-core'
```

**`createPkceFlow(params: ICreatePkceFlowParams): IPkceFlow`**
Full PKCE authorization code flow (RFC 6749 §4.1 + RFC 7636). Stores PKCE state in `pendingStorage`, tokens in `tokenStorage` on `exchangeCode`. See usage below.

**`createTokenManager(params: ICreateTokenManagerParams): ITokenManager`**
Token lifecycle manager. Reads/writes from `IStorage<IStoredTokens>`. Calls `tokenProvider.refreshToken` when the access token is stale. Optional `onRefresh` callback fired after each successful refresh.

**`pollDeviceToken(params: IDeviceFlowPollParams): Promise<IOAuthWireTokenResponse>`**
RFC 8628 §3.5 polling state machine. Returns wire token response on success; throws `AuthError` for cancelled / denied / expired / other failure.

**`tokenResponseToStored(tokenResponse: ITokenResponse): IStoredTokens`**
Maps camelCase `ITokenResponse` to `IStoredTokens` (ISO timestamp, scope splitting). Shared by PKCE and device flow paths.

**`wireTokenResponseToStored(wire: IOAuthWireTokenResponse): IStoredTokens`**
Maps RFC 6749 §5.1 snake_case wire response to `IStoredTokens`. Uses `tokenResponseToStored` internally.

**`createCodeChallenge(codeVerifier: string): Promise<string>`**
RFC 7636 S256 challenge: `BASE64URL(SHA256(codeVerifier))`. `createPkceFlow` calls this internally; exposed for custom flows.

**`createRandomString(): string`**
`crypto.randomUUID()` with hyphens removed. Used for `state` and `codeVerifier` generation.

---

### Interfaces

```typescript
// Storage shapes
interface IStoredTokens {
  accessToken?: string
  refreshToken?: string
  idToken?: string
  tokenType?: string
  scopes?: string[]
  accessTokenExpiresAt?: string   // ISO 8601
}

interface IPendingOAuthState {
  codeVerifier: string
  state: string
  redirectTo: string              // Post-login destination
}

// OAuth2 token endpoint port (RFC 6749 §3.2)
interface IOAuth2TokenProvider {
  exchangeCode(params: ICodeExchangeParams): Promise<ITokenResponse>
  refreshToken(params: IRefreshParams): Promise<ITokenResponse>
}

interface ICodeExchangeParams {
  code: string
  codeVerifier: string
  redirectUri: string
  clientId: string
  audience: string
}

interface IRefreshParams {
  refreshToken: string
  clientId: string
  audience: string
  scope?: string
}

interface ITokenResponse {
  accessToken: string
  refreshToken?: string
  idToken?: string
  tokenType: string               // e.g., 'Bearer'
  scope?: string                  // space-separated
  expiresAt: number               // Unix timestamp (seconds)
}

// Wire-shape RFC 6749 §5.1 response (snake_case, expires_in relative)
interface IOAuthWireTokenResponse {
  access_token: string
  refresh_token?: string
  id_token?: string
  token_type: string
  expires_in: number
  scope?: string
}

// PKCE flow config
interface IPkceFlowConfig {
  authBaseURL: string
  clientId: string
  audience: string
  redirectURI: string | (() => string)
  scope: string                   // Required: space-separated RFC 6749 scope string
}

// PKCE flow
interface IPkceFlow {
  authorizeEndpoint: string
  prepareAuthorizationURL(redirectTo?: string): Promise<URL>     // generates + stores PKCE state
  getPreparedAuthorizationURL(): Promise<URL>                     // returns stored URL without regenerating
  prepareExchange(params: { code: string; state: string | null }): {
    exchangeParams: ICodeExchangeParams
    redirectTo: string
  }
  completeExchange(tokenResponse: ITokenResponse): void
  exchangeCode(params: { code: string; state: string | null }): Promise<string>  // returns redirectTo
}

// Token manager
interface ITokenManager {
  getValidToken(): Promise<string | null>   // returns access token, auto-refreshes if stale
  refresh(): Promise<string | null>         // force refresh
  store(tokens: IStoredTokens): void
  clear(): void
  getStored(): IStoredTokens | null
}

// Device flow port (RFC 8628)
interface IDeviceFlowProvider {
  startDeviceCode(request: IDeviceCodeRequest): Promise<IDeviceCodeResponse>
  exchangeToken(request: IDeviceTokenRequest): Promise<IDeviceTokenPollResult>
}

type IDeviceTokenPollResult =
  | { tag: 'success'; tokens: IOAuthWireTokenResponse }
  | { tag: 'pending' }
  | { tag: 'slow_down' }
  | { tag: 'denied' }
  | { tag: 'expired' }
  | { tag: 'failed'; oauthError: string; description?: string }

// Structured error
class AuthError extends Error {
  readonly kind: IAuthErrorKind   // 'oauth' | 'callback' | 'transport' | 'cancelled'
  readonly oauthError?: string
}
```

---

## Coding Style

- Language: TypeScript strict. Prefer `async/await`.
- Formatting: Biome, 2-space indentation, single quotes, trailing commas.
- File/folder naming: kebab-case only.
- Interfaces and types: MUST prefix with `I` (e.g., `ITokenManager`). Avoid `any`; prefer `unknown`.
- Return types: prefer inference; annotate exported factory return types.
- Require curly braces for all control statements.
- Tests: co-locate as `*.test.ts`; use Vitest. No network fixtures — mock `IOAuth2TokenProvider`, `IDeviceFlowProvider`, and `IStorage`.

---

## Examples & Patterns

### Full OAuth 2.0 PKCE flow (browser)
```typescript
import { createPkceFlow } from '@common/auth-core'
import type { IOAuth2TokenProvider } from '@common/auth-core'
import { createLocalStorage, createSessionStorage } from '@common/core-storage/web'

const myProvider: IOAuth2TokenProvider = {
  async exchangeCode(params) { /* POST /oauth2/token with authorization_code grant */ },
  async refreshToken(params) { /* POST /oauth2/token with refresh_token grant */ },
}

const flow = createPkceFlow({
  config: {
    authBaseURL: 'https://auth.example.com/api/auth',
    clientId: 'my-client',
    audience: 'https://api.example.com',
    redirectURI: () => `${window.location.origin}/auth/callback`,
    scope: 'openid profile email offline_access',
  },
  tokenProvider: myProvider,
  tokenStorage: createLocalStorage({ prefix: 'app' }),
  pendingStorage: createSessionStorage({ prefix: 'app' }),
})

// Step 1 — redirect user
const url = await flow.prepareAuthorizationURL('/dashboard')
window.location.href = url.toString()

// Step 2 — callback handler
const redirectTo = await flow.exchangeCode({
  code: new URL(location.href).searchParams.get('code'),
  state: new URL(location.href).searchParams.get('state'),
})
window.location.href = redirectTo
```

### Token manager (inject into API client)
```typescript
import { createTokenManager } from '@common/auth-core'
import { createLocalStorage } from '@common/core-storage/web'

const tokenManager = createTokenManager({
  storage: createLocalStorage({ prefix: 'app' }),
  tokenProvider: myProvider,
  options: { clientId: 'my-client', audience: 'https://api.example.com' },
  onRefresh: (tokens) => { /* sync new tokens to other storage if needed */ },
})

// In an API client beforeRequest hook:
const token = await tokenManager.getValidToken()
req.headers.set('Authorization', `Bearer ${token}`)
```

### RFC 8628 Device flow polling
```typescript
import { pollDeviceToken, wireTokenResponseToStored } from '@common/auth-core'
import type { IDeviceFlowProvider } from '@common/auth-core'

const wireTokens = await pollDeviceToken({
  provider: myDeviceFlowProvider,
  deviceCode: init.device_code,
  clientId: 'my-client',
  codeVerifier,
  initialIntervalSec: init.interval,
  expiresInSec: init.expires_in,
  signal: abortController.signal,
})
tokenManager.store(wireTokenResponseToStored(wireTokens))
```
