import type {
	ICreateTokenManagerParams,
	IStoredTokens,
	ITokenManager,
} from './types';

const TOKEN_REFRESH_SKEW_MS = 60_000;
const TOKENS_KEY = 'auth.tokens';

const isTokenFresh = (tokens: IStoredTokens | null): boolean => {
	if (!tokens?.accessToken) return false;
	if (!tokens.accessTokenExpiresAt) return true;
	return (
		new Date(tokens.accessTokenExpiresAt).getTime() - Date.now() >
		TOKEN_REFRESH_SKEW_MS
	);
};

export const createTokenManager = ({
	storage,
	tokenProvider,
	options,
	onRefresh,
}: ICreateTokenManagerParams): ITokenManager => {
	const refresh = async (): Promise<string | null> => {
		const stored = storage.get(TOKENS_KEY);
		if (!stored?.refreshToken) {
			return null;
		}

		const tokenResponse = await tokenProvider
			.refreshToken({
				refreshToken: stored.refreshToken,
				clientId: options.clientId,
				audience: options.audience,
				scope: stored.scopes?.join(' '),
			})
			.catch(() => {
				storage.remove(TOKENS_KEY);
				throw new Error('Failed to refresh OAuth access token');
			});

		const next: IStoredTokens = {
			accessToken: tokenResponse.accessToken,
			refreshToken: tokenResponse.refreshToken ?? stored.refreshToken,
			idToken: tokenResponse.idToken ?? stored.idToken,
			tokenType: tokenResponse.tokenType,
			scopes: tokenResponse.scope?.split(' ') ?? stored.scopes,
			accessTokenExpiresAt: new Date(
				tokenResponse.expiresAt * 1000,
			).toISOString(),
		};

		storage.set(TOKENS_KEY, next);
		await onRefresh?.(next);
		return next.accessToken ?? null;
	};

	return {
		getValidToken: async () => {
			const stored = storage.get(TOKENS_KEY);
			if (isTokenFresh(stored)) return stored!.accessToken!;
			return refresh();
		},
		refresh,
		store: (tokens) => storage.set(TOKENS_KEY, tokens),
		clear: () => storage.remove(TOKENS_KEY),
		getStored: () => storage.get(TOKENS_KEY),
	};
};
