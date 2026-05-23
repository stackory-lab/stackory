import type { IOAuth2TokenProvider, ITokenResponse } from '@stackory/auth-core';

/**
 * better-auth oauth-provider's token endpoint response shape. RFC 6749 §5.1
 * specifies `expires_in` (relative seconds); better-auth returns `expires_at`
 * (absolute unix seconds) as an extension. This adapter is the single point
 * that consumes that non-standard field — auth-core itself stays RFC-pure.
 *
 * If a different OAuth server is targeted, write a sibling adapter against
 * its actual wire shape rather than extending this one.
 */
interface IBetterAuthTokenResponse {
	access_token: string;
	expires_at: number; // better-auth extension; absolute unix seconds
	token_type?: string;
	scope?: string;
	refresh_token?: string;
	id_token?: string;
}

const toTokenResponse = (data: IBetterAuthTokenResponse): ITokenResponse => ({
	accessToken: data.access_token,
	refreshToken: data.refresh_token,
	idToken: data.id_token,
	tokenType: data.token_type ?? 'Bearer',
	scope: data.scope,
	expiresAt: data.expires_at,
});

const postForm = async (
	endpoint: string,
	params: Record<string, string>,
): Promise<IBetterAuthTokenResponse> => {
	const res = await fetch(endpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(params),
	});
	if (!res.ok) {
		throw new Error(`OAuth token request failed: ${res.status}`);
	}
	return res.json() as Promise<IBetterAuthTokenResponse>;
};

/**
 * Adapter that implements auth-core's {@link IOAuth2TokenProvider} port
 * against a better-auth oauth-provider token endpoint. Counterpart of
 * {@link createDeviceFlowProvider} (RFC 8628). See module comment for the
 * `expires_at` extension handling.
 */
export const createOAuth2TokenProvider = (
	tokenEndpoint: string,
): IOAuth2TokenProvider => ({
	exchangeCode: async (params) => {
		const data = await postForm(tokenEndpoint, {
			grant_type: 'authorization_code',
			code: params.code,
			code_verifier: params.codeVerifier,
			redirect_uri: params.redirectUri,
			client_id: params.clientId,
			resource: params.audience,
		});
		return toTokenResponse(data);
	},

	refreshToken: async (params) => {
		const body: Record<string, string> = {
			grant_type: 'refresh_token',
			refresh_token: params.refreshToken,
			client_id: params.clientId,
			resource: params.audience,
		};
		if (params.scope) {
			body.scope = params.scope;
		}
		const data = await postForm(tokenEndpoint, body).catch(() => {
			throw new Error('Failed to refresh OAuth access token');
		});
		return toTokenResponse(data);
	},
});
