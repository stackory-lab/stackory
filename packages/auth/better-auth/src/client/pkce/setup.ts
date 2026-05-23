import type {
	IOAuth2TokenProvider,
	IPendingOAuthState,
	IPkceFlow,
	IStoredTokens,
	ITokenManager,
} from '@stackory/auth-core';
import { createPkceFlow, createTokenManager } from '@stackory/auth-core';
import type { IStorage } from '@stackory/contracts';
import { createAuthConfig } from '../../shared/config';
import { createOAuth2TokenProvider } from '../oauth2-token-provider';

/**
 * Wire helper: composes the better-auth {@link createOAuth2TokenProvider}
 * adapter with auth-core's PKCE state machine and token manager. PKCE flow
 * itself is cross-process (browser redirect → callback), so there is no
 * runtime `run` helper — the calling app drives navigation / callback and
 * uses `pkceFlow.prepareAuthorizationURL()` / `.exchangeCode()` directly.
 *
 * Returns wired-up resources rather than just a setup callback because PKCE
 * tokenManager and pkceFlow MUST share the same {@link IOAuth2TokenProvider}
 * instance (both hit `/oauth2/token`).
 */
export interface ICreatePkceSetupParams {
	baseURL?: string;
	basePath?: string;
	clientId: string;
	audience: string;
	/** Space-separated RFC 6749 scope sent on the authorize request. */
	scope: string;
	redirectURI: string | (() => string);
	tokenStorage: IStorage<IStoredTokens>;
	pendingStorage: IStorage<IPendingOAuthState>;
	onRefresh?: (tokens: IStoredTokens) => void | Promise<void>;
}

export interface IPkceSetup {
	pkceFlow: IPkceFlow;
	tokenManager: ITokenManager;
	/** Exposed as escape hatch for custom orchestrations. */
	tokenProvider: IOAuth2TokenProvider;
}

export const createPkceSetup = ({
	baseURL,
	basePath,
	clientId,
	audience,
	scope,
	redirectURI,
	tokenStorage,
	pendingStorage,
	onRefresh,
}: ICreatePkceSetupParams): IPkceSetup => {
	const { tokenEndpoint } = createAuthConfig({ baseURL, basePath });
	const authServerURL = `${baseURL}${basePath}`;

	const tokenProvider = createOAuth2TokenProvider(tokenEndpoint);

	const pkceFlow = createPkceFlow({
		pendingStorage,
		tokenStorage,
		config: {
			authBaseURL: authServerURL,
			clientId,
			audience,
			scope,
			redirectURI,
		},
		tokenProvider,
	});

	const tokenManager = createTokenManager({
		storage: tokenStorage,
		tokenProvider,
		options: { clientId, audience },
		onRefresh,
	});

	return { pkceFlow, tokenManager, tokenProvider };
};
