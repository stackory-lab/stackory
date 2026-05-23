/**
 * Error thrown by client-side better-auth RPC wrappers when the server
 * returns `{ error: { message, code } }`. Preserves the structured `code`
 * (e.g. `SESSION_NOT_FRESH`, `UNAUTHORIZED`) so UI layers can branch on it
 * instead of fragile string matching of `message`.
 */
export class BetterAuthClientError extends Error {
	readonly code?: string;

	constructor(message: string, code?: string) {
		super(message);
		this.name = 'BetterAuthClientError';
		this.code = code;
	}
}

export const isBetterAuthClientError = (
	err: unknown,
): err is BetterAuthClientError => {
	return err instanceof BetterAuthClientError;
};

/**
 * Generic unwrap for `{ data, error }` envelopes returned by the better-auth
 * client. On error, throws {@link BetterAuthClientError} carrying the server
 * `code` for structured handling.
 */
export const unwrapBetterAuthResponse = <TData>(
	result: {
		data: TData | null;
		error: { message?: string; code?: string } | null;
	},
	fallbackMessage: string,
): TData => {
	if (result.error || !result.data) {
		throw new BetterAuthClientError(
			result.error?.message ?? fallbackMessage,
			result.error?.code,
		);
	}
	return result.data;
};
