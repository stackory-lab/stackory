import type { IStoredTokens, ITokenResponse } from './types';

/**
 * Canonical mapping from {@link ITokenResponse} (internal camelCase) to
 * {@link IStoredTokens} (storage shape). Single source of truth for
 * scope splitting and `accessTokenExpiresAt` ISO formatting — both PKCE
 * (`createPkceFlow.completeExchange`) and device flow consumers share it.
 *
 * `scopes` falls through (`undefined`) when the server omits scope; refresh
 * still works because `tokenManager.refresh` only sends scope when present.
 * Business layer decides whether to backfill a default at storage time.
 */
export const tokenResponseToStored = (
	tokenResponse: ITokenResponse,
): IStoredTokens => {
	return {
		accessToken: tokenResponse.accessToken,
		refreshToken: tokenResponse.refreshToken,
		idToken: tokenResponse.idToken,
		tokenType: tokenResponse.tokenType,
		scopes: tokenResponse.scope?.split(' '),
		accessTokenExpiresAt: new Date(
			tokenResponse.expiresAt * 1000,
		).toISOString(),
	};
};

/**
 * Wire-shape OAuth2 token response (RFC 6749 §5.1, snake_case). Surfaces
 * `expires_in` (relative) rather than absolute `expiresAt` — useful when
 * a flow receives the RFC body directly from an OAuth2 token endpoint and
 * has not normalized to ITokenResponse.
 */
export interface IOAuthWireTokenResponse {
	access_token: string;
	refresh_token?: string;
	id_token?: string;
	token_type: string;
	expires_in: number;
	scope?: string;
}

/**
 * Maps the snake_case wire OAuth token response to {@link IStoredTokens}.
 * Uses {@link tokenResponseToStored} internally so the persistence shape
 * stays in lockstep with the camelCase path.
 */
export const wireTokenResponseToStored = (
	wire: IOAuthWireTokenResponse,
): IStoredTokens => {
	return tokenResponseToStored({
		accessToken: wire.access_token,
		refreshToken: wire.refresh_token,
		idToken: wire.id_token,
		tokenType: wire.token_type,
		scope: wire.scope,
		expiresAt: Math.floor(Date.now() / 1000) + wire.expires_in,
	});
};
