import { oauthProviderClient } from '@better-auth/oauth-provider/client';
import { createAuthClient } from 'better-auth/client';
import { unwrapBetterAuthResponse } from '../better-auth-client-error';

export interface ICreateSessionActionsParams {
	baseURL?: string;
	basePath?: string;
}

/**
 * Portable local mirror of the fields actually consumed from OAuthClient
 * (@better-auth/oauth-provider). Using a local interface here prevents TS2742
 * ("inferred type cannot be named") in consumer packages that don't have
 * @better-auth/oauth-provider as a direct dependency.
 */
export interface IOAuthClientPublic {
	client_id?: string | null;
	client_name?: string | null;
	logo_uri?: string | null;
}

/**
 * Typed RPC wrappers around better-auth's non-flow client endpoints:
 *   - generic session: getSession, signOut
 *   - social sign-in entry: signInSocial
 *   - oauth-provider consent: getOAuthClientPublic, submitOAuthConsent
 *
 * Device-flow specific UI actions live in
 * {@link createDeviceActions} (`@common/auth-better-auth/client/device`).
 */
export const createSessionActions = ({
	baseURL,
	basePath,
}: ICreateSessionActionsParams) => {
	const client = createAuthClient({
		baseURL,
		basePath,
		plugins: [oauthProviderClient()],
	});

	return {
		getOAuthClientPublic: async (
			clientId: string,
		): Promise<IOAuthClientPublic> => {
			const result = await client.oauth2.publicClient({
				query: { client_id: clientId },
			});

			return unwrapBetterAuthResponse<IOAuthClientPublic>(
				result,
				'Failed to load OAuth client',
			);
		},
		submitOAuthConsent: async (consent: {
			accept: boolean;
			scope?: string;
		}) => {
			const result = await client.oauth2.consent({
				accept: consent.accept,
				scope: consent.scope,
			});

			return unwrapBetterAuthResponse(result, 'Failed to submit OAuth consent');
		},
		signInSocial: async (params: {
			provider: string;
			callbackURL: string;
			disableRedirect?: boolean;
		}) => {
			const result = await client.signIn.social({
				provider: params.provider,
				callbackURL: params.callbackURL,
				disableRedirect: params.disableRedirect,
			});

			return unwrapBetterAuthResponse(result, 'Social sign-in failed');
		},
		getSession: async () => {
			const result = await client.getSession();
			if (result.error || !result.data) {
				return null;
			}
			return result.data;
		},
		signOut: async () => {
			const { error } = await client.signOut();
			if (error) {
				throw new Error('Sign-out failed');
			}
		},
	};
};
