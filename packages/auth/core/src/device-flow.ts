import { AuthError } from './auth-error';
import type { IOAuthWireTokenResponse } from './token-mapping';

// ─── RFC 8628 wire shapes ────────────────────────────────────────────────────

/**
 * RFC 8628 §3.1 device authorization request body. The wire format is
 * `application/x-www-form-urlencoded`; this interface mirrors the field
 * names (snake_case) and types so any transport that speaks RFC 8628 can
 * implement {@link IDeviceFlowTransport} without translation.
 */
export interface IDeviceCodeRequest {
	client_id: string;
	scope?: string;
	resource?: string | string[];
	code_challenge?: string;
	code_challenge_method?: 'S256';
}

/** RFC 8628 §3.2 device authorization response. */
export interface IDeviceCodeResponse {
	device_code: string;
	user_code: string;
	verification_uri: string;
	verification_uri_complete?: string;
	expires_in: number;
	interval: number;
}

/** RFC 8628 §3.4 device access token request body. */
export interface IDeviceTokenRequest {
	grant_type: 'urn:ietf:params:oauth:grant-type:device_code';
	device_code: string;
	client_id: string;
	code_verifier?: string;
}

/**
 * Discriminated polling result for {@link IDeviceFlowProvider.exchangeToken}.
 * The provider must translate its underlying HTTP / SDK error into one of
 * these variants so the state machine can drive the polling loop without
 * knowing about HTTP status codes, SDK error shapes, etc.
 */
export type IDeviceTokenPollResult =
	| { tag: 'success'; tokens: IOAuthWireTokenResponse }
	| { tag: 'pending' }
	| { tag: 'slow_down' }
	| { tag: 'denied' }
	| { tag: 'expired' }
	| { tag: 'failed'; oauthError: string; description?: string };

/**
 * Port for RFC 8628 device authorization (`/device/code` + `/device/token`).
 * Counterpart of {@link IOAuth2TokenProvider} for the PKCE flow. Adapters
 * implement this against a specific server (e.g. better-auth's device-flow
 * plugin endpoints).
 */
export interface IDeviceFlowProvider {
	startDeviceCode(request: IDeviceCodeRequest): Promise<IDeviceCodeResponse>;
	exchangeToken(request: IDeviceTokenRequest): Promise<IDeviceTokenPollResult>;
}

// ─── State machine ────────────────────────────────────────────────────────────

const POLL_BACKOFF_INCREMENT_SEC = 5;
const POLL_MAX_INTERVAL_SEC = 30;

export interface IDeviceFlowPollParams {
	provider: IDeviceFlowProvider;
	deviceCode: string;
	clientId: string;
	codeVerifier?: string;
	initialIntervalSec: number;
	expiresInSec: number;
	signal?: AbortSignal;
	/**
	 * Monotonic time source in milliseconds. Defaults to {@link Date.now};
	 * inject `() => performance.now()` in production to be immune to wall-
	 * clock changes (NTP, sleep). Tests inject a stub for deterministic
	 * deadline triggering.
	 */
	now?: () => number;
}

const sleepWithCancel = (ms: number, signal?: AbortSignal) =>
	new Promise<void>((resolve, reject) => {
		const timer = setTimeout(resolve, ms);
		signal?.addEventListener(
			'abort',
			() => {
				clearTimeout(timer);
				reject(
					new AuthError({
						kind: 'cancelled',
						message: 'Device login cancelled',
					}),
				);
			},
			{ once: true },
		);
	});

/**
 * Drives the RFC 8628 §3.5 polling loop. Uses a monotonic clock so wall-time
 * jumps cannot mark the code as not-yet-expired or expire it early. `slow_down`
 * bumps interval by 5s (capped at 30s) per RFC 8628 §3.5.
 *
 * Throws {@link AuthError} for every non-success exit: `cancelled` (AbortSignal),
 * `oauth` with appropriate `oauthError` for denied / expired / other server-side
 * failure. The success branch returns the RFC 6749 §5.1 token response (with
 * `expires_in`), which the caller can feed into `wireTokenResponseToStored`.
 */
export const pollDeviceToken = async (
	params: IDeviceFlowPollParams,
): Promise<IOAuthWireTokenResponse> => {
	let intervalSec = params.initialIntervalSec;
	const now = params.now ?? Date.now;
	const deadline = now() + params.expiresInSec * 1000;

	while (true) {
		if (params.signal?.aborted) {
			throw new AuthError({
				kind: 'cancelled',
				message: 'Device login cancelled',
			});
		}
		if (now() >= deadline) {
			throw new AuthError({
				kind: 'oauth',
				oauthError: 'expired_token',
				message: 'Device login expired before the user finished approving',
			});
		}

		const result = await params.provider.exchangeToken({
			grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
			device_code: params.deviceCode,
			client_id: params.clientId,
			code_verifier: params.codeVerifier,
		});

		switch (result.tag) {
			case 'success':
				return result.tokens;
			case 'pending':
				break;
			case 'slow_down':
				intervalSec = Math.min(
					intervalSec + POLL_BACKOFF_INCREMENT_SEC,
					POLL_MAX_INTERVAL_SEC,
				);
				break;
			case 'denied':
				throw new AuthError({
					kind: 'oauth',
					oauthError: 'access_denied',
					message: 'Device login was denied from the browser',
				});
			case 'expired':
				throw new AuthError({
					kind: 'oauth',
					oauthError: 'expired_token',
					message: 'Device login code expired',
				});
			case 'failed':
				throw new AuthError({
					kind: 'oauth',
					oauthError: result.oauthError,
					message: result.description ?? result.oauthError,
				});
		}

		await sleepWithCancel(intervalSec * 1000, params.signal);
	}
};
