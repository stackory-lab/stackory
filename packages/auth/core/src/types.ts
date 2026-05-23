import type { IStorage } from '@stackory/contracts';

// ─── Token Storage ────────────────────────────────────────────────────────────

export interface IStoredTokens {
	accessToken?: string;
	refreshToken?: string;
	idToken?: string;
	tokenType?: string;
	scopes?: string[];
	accessTokenExpiresAt?: string;
}

export interface IPendingOAuthState {
	codeVerifier: string;
	state: string;
	redirectTo: string;
}

// ─── PKCE Flow Config ─────────────────────────────────────────────────────────

export interface IPkceFlowConfig {
	authBaseURL: string;
	clientId: string;
	audience: string;
	redirectURI: string | (() => string);
	/**
	 * Space-separated RFC 6749 scope string sent on the authorize request.
	 * Required: there is no auth-core default. Business layer owns the
	 * choice of scopes (e.g. OIDC needs `openid`).
	 */
	scope: string;
}

// ─── OAuth2 Token Endpoint Provider (port) ───────────────────────────────────

export interface ICodeExchangeParams {
	code: string;
	codeVerifier: string;
	redirectUri: string;
	clientId: string;
	audience: string;
}

export interface IRefreshParams {
	refreshToken: string;
	clientId: string;
	audience: string;
	scope?: string;
}

export interface ITokenResponse {
	accessToken: string;
	refreshToken?: string;
	idToken?: string;
	tokenType: string;
	scope?: string;
	expiresAt: number; // unix timestamp (seconds)
}

/**
 * Port for an OAuth2 token endpoint (RFC 6749 §3.2). Adapters implement this
 * against a specific server (e.g. better-auth's `/oauth2/token`). Used by
 * {@link IPkceFlow} for `authorization_code` exchange and by {@link ITokenManager}
 * for `refresh_token` exchange.
 */
export interface IOAuth2TokenProvider {
	exchangeCode: (params: ICodeExchangeParams) => Promise<ITokenResponse>;
	refreshToken: (params: IRefreshParams) => Promise<ITokenResponse>;
}

// ─── PKCE Flow ────────────────────────────────────────────────────────────────

export interface ICreatePkceFlowParams {
	pendingStorage: IStorage<IPendingOAuthState>;
	tokenStorage: IStorage<IStoredTokens>;
	config: IPkceFlowConfig;
	tokenProvider: IOAuth2TokenProvider;
}

export interface IPkceFlow {
	authorizeEndpoint: string;
	prepareAuthorizationURL: (redirectTo?: string) => Promise<URL>;
	getPreparedAuthorizationURL: () => Promise<URL>;
	prepareExchange: (params: { code: string; state: string | null }) => {
		exchangeParams: ICodeExchangeParams;
		redirectTo: string;
	};
	completeExchange: (tokenResponse: ITokenResponse) => void;
	exchangeCode: (params: {
		code: string;
		state: string | null;
	}) => Promise<string>;
}

// ─── Token Manager ────────────────────────────────────────────────────────────

export interface ITokenManagerOptions {
	clientId: string;
	audience: string;
}

export interface ICreateTokenManagerParams {
	storage: IStorage<IStoredTokens>;
	tokenProvider: IOAuth2TokenProvider;
	options: ITokenManagerOptions;
	onRefresh?: (tokens: IStoredTokens) => void | Promise<void>;
}

export interface ITokenManager {
	getValidToken: () => Promise<string | null>;
	refresh: () => Promise<string | null>;
	store: (tokens: IStoredTokens) => void;
	clear: () => void;
	getStored: () => IStoredTokens | null;
}
