/**
 * Structured failure for any OAuth login path (PKCE callback flow, device flow,
 * future passkey / SSO direct). UI / telemetry can branch on `kind` and
 * `oauthError` without parsing stringified messages.
 */
export type IAuthErrorKind =
	| 'oauth' // OAuth error code returned by the server (see `oauthError`)
	| 'callback' // Local OAuth callback failed (e.g. missing code/state)
	| 'transport' // Network / fetch failure before the server could respond
	| 'cancelled'; // User aborted (e.g. ctrl-C, AbortSignal triggered)

export interface IAuthErrorOptions {
	kind: IAuthErrorKind;
	message: string;
	oauthError?: string;
	cause?: unknown;
}

export class AuthError extends Error {
	readonly kind: IAuthErrorKind;
	readonly oauthError?: string;

	constructor(options: IAuthErrorOptions) {
		super(
			options.message,
			options.cause ? { cause: options.cause } : undefined,
		);
		this.name = 'AuthError';
		this.kind = options.kind;
		this.oauthError = options.oauthError;
	}
}

export const isAuthError = (error: unknown): error is AuthError => {
	return error instanceof AuthError;
};
