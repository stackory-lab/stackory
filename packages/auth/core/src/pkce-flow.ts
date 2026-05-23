import { createCodeChallenge, createRandomString } from './pkce';
import { tokenResponseToStored } from './token-mapping';
import type { ICreatePkceFlowParams, IPkceFlow, ITokenResponse } from './types';

const PENDING_STATE_KEY = 'auth.pending-state';
const TOKENS_KEY = 'auth.tokens';

/**
 * RFC 6749 §4.1 Authorization Code Grant + RFC 7636 PKCE state machine.
 * Counterpart to {@link pollDeviceToken} (RFC 8628 Device Authorization
 * Grant) — both are OAuth 2.0 flows, this one uses a browser redirect and
 * a callback, the other uses out-of-band code display and polling.
 */
export const createPkceFlow = ({
	pendingStorage,
	tokenStorage,
	config,
	tokenProvider,
}: ICreatePkceFlowParams): IPkceFlow => {
	const authorizeEndpoint = `${config.authBaseURL}/oauth2/authorize`;

	const buildAuthorizationURL = async (params: {
		codeVerifier: string;
		state: string;
	}): Promise<URL> => {
		const codeChallenge = await createCodeChallenge(params.codeVerifier);

		const url = new URL(authorizeEndpoint);
		url.searchParams.set('response_type', 'code');
		url.searchParams.set('client_id', config.clientId);
		url.searchParams.set(
			'redirect_uri',
			typeof config.redirectURI === 'function'
				? config.redirectURI()
				: config.redirectURI,
		);
		url.searchParams.set('scope', config.scope);
		url.searchParams.set('resource', config.audience);
		url.searchParams.set('state', params.state);
		url.searchParams.set('code_challenge', codeChallenge);
		url.searchParams.set('code_challenge_method', 'S256');

		return url;
	};

	const prepareExchange = ({
		code,
		state,
	}: {
		code: string;
		state: string | null;
	}) => {
		const pendingState = pendingStorage.get(PENDING_STATE_KEY);
		if (!pendingState) throw new Error('Missing pending OAuth state');

		if (!state || state !== pendingState.state) {
			pendingStorage.remove(PENDING_STATE_KEY);
			throw new Error('OAuth state mismatch');
		}

		return {
			exchangeParams: {
				code,
				codeVerifier: pendingState.codeVerifier,
				redirectUri:
					typeof config.redirectURI === 'function'
						? config.redirectURI()
						: config.redirectURI,
				clientId: config.clientId,
				audience: config.audience,
			},
			redirectTo: pendingState.redirectTo,
		};
	};

	const completeExchange = (tokenResponse: ITokenResponse) => {
		tokenStorage.set(TOKENS_KEY, tokenResponseToStored(tokenResponse));
		pendingStorage.remove(PENDING_STATE_KEY);
	};

	return {
		authorizeEndpoint,

		prepareAuthorizationURL: async (redirectTo = '/') => {
			const codeVerifier = createRandomString();
			const state = createRandomString();

			pendingStorage.set(PENDING_STATE_KEY, {
				codeVerifier,
				state,
				redirectTo,
			});

			return buildAuthorizationURL({ codeVerifier, state });
		},

		getPreparedAuthorizationURL: async () => {
			const pendingState = pendingStorage.get(PENDING_STATE_KEY);
			if (!pendingState) {
				throw new Error('Missing pending OAuth state');
			}

			return buildAuthorizationURL({
				codeVerifier: pendingState.codeVerifier,
				state: pendingState.state,
			});
		},

		prepareExchange,
		completeExchange,

		exchangeCode: async ({ code, state }) => {
			const { exchangeParams, redirectTo } = prepareExchange({ code, state });
			const tokenResponse = await tokenProvider.exchangeCode(exchangeParams);
			completeExchange(tokenResponse);
			return redirectTo;
		},
	};
};
