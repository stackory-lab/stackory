// Foundational adapter: better-auth oauth-provider /oauth2/token endpoint.
// Used by both the PKCE flow (exchangeCode) and tokenManager (refresh).

// Cross-cutting structured error.
export {
	BetterAuthClientError,
	isBetterAuthClientError,
} from './better-auth-client-error';
// Flow-grouped re-exports — preferred entry points for consumers.
export * from './device';
export { createOAuth2TokenProvider } from './oauth2-token-provider';
export * from './pkce';
export * from './session';
