import type {
	IDeviceCodeRequest,
	IDeviceCodeResponse,
	IDeviceFlowProvider,
	IDeviceTokenPollResult,
	IDeviceTokenRequest,
	IOAuthWireTokenResponse,
} from '@stackory/auth-core';
import { DEVICE_FLOW_ERROR_CODES } from '../../shared/constants';

// ─── better-auth client envelope ─────────────────────────────────────────────

interface IBetterAuthError {
	error?: string;
	error_description?: string;
	message?: string;
	code?: string;
	status?: number;
}

type IClientResult<T> = { data: T | null; error: IBetterAuthError | null };

/**
 * Minimum shape required from a better-auth client. The real `authClient`
 * (created with the `deviceFlowClient()` plugin) satisfies this via
 * `$InferServerPlugin` — these methods are auto-derived.
 */
export interface IDeviceAuthClient {
	device: {
		code(
			request: IDeviceCodeRequest,
		): Promise<IClientResult<IDeviceCodeResponse>>;
		token(
			request: IDeviceTokenRequest,
		): Promise<IClientResult<IOAuthWireTokenResponse>>;
	};
}

// ─── Error translation ───────────────────────────────────────────────────────

const toPollResult = (
	result: IClientResult<IOAuthWireTokenResponse>,
): IDeviceTokenPollResult => {
	if (result.data) {
		return { tag: 'success', tokens: result.data };
	}
	const code = result.error?.error ?? result.error?.code ?? 'unknown';
	const description = result.error?.error_description ?? result.error?.message;

	switch (code) {
		case DEVICE_FLOW_ERROR_CODES.authorizationPending:
			return { tag: 'pending' };
		case DEVICE_FLOW_ERROR_CODES.slowDown:
			return { tag: 'slow_down' };
		case DEVICE_FLOW_ERROR_CODES.accessDenied:
			return { tag: 'denied' };
		case DEVICE_FLOW_ERROR_CODES.expiredToken:
			return { tag: 'expired' };
		default:
			return { tag: 'failed', oauthError: code, description };
	}
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Adapter that implements auth-core's {@link IDeviceFlowProvider} port
 * against a better-auth device-flow plugin (`deviceFlowClient()`).
 * Counterpart of {@link createOAuth2TokenProvider} (RFC 6749 §3.2).
 *
 * The caller passes the resulting provider to `pollDeviceToken` (auth-core)
 * directly, or wraps it with {@link createDeviceLogin} for the full
 * "PKCE pair → start → prompt → poll → store" orchestration.
 */
export const createDeviceFlowProvider = (
	authClient: IDeviceAuthClient,
): IDeviceFlowProvider => ({
	startDeviceCode: async (request) => {
		const result = await authClient.device.code(request);
		if (result.data) {
			return result.data;
		}
		const code = result.error?.error ?? result.error?.code ?? 'request_failed';
		const description =
			result.error?.error_description ??
			result.error?.message ??
			'Failed to start device authorization';
		throw new Error(`${code}: ${description}`);
	},
	exchangeToken: async (request) => {
		return toPollResult(await authClient.device.token(request));
	},
});
