import {
	createCodeChallenge,
	createRandomString,
	type IDeviceFlowProvider,
	type ITokenManager,
	pollDeviceToken,
	wireTokenResponseToStored,
} from '@stackory/auth-core';

// ─── Public API ──────────────────────────────────────────────────────────────

export interface IDeviceLoginUserPrompt {
	userCode: string;
	verificationUri: string;
	verificationUriComplete: string;
	expiresIn: number;
}

export interface IRunDeviceLoginOptions {
	/** Fired right after the device code is issued — UI shows the user_code. */
	onUserPrompt?: (prompt: IDeviceLoginUserPrompt) => void;
	/**
	 * Fired after `onUserPrompt`. The helper `await`s this callback before
	 * polling starts, so a CLI with a browser can open the URL here (via
	 * `open` package) while a headless / web environment may navigate
	 * directly or no-op.
	 */
	onVerificationUri?: (verificationUriComplete: string) => void | Promise<void>;
	signal?: AbortSignal;
}

export interface ICreateDeviceLoginParams {
	provider: IDeviceFlowProvider;
	tokenManager: ITokenManager;
	clientId: string;
	scope: string;
	/** RFC 8707 resource indicator. */
	resource: string | string[];
}

/**
 * Optional convenience helper for the full RFC 8628 login orchestration on
 * top of an {@link IDeviceFlowProvider}:
 *   PKCE pair → start_device_code → onUserPrompt → onVerificationUri →
 *   poll → tokenManager.store.
 *
 * Provided because device flow is a single-process polling protocol that
 * can be wrapped end-to-end. PKCE flow has no such helper — its browser
 * redirect + callback span across processes and must be orchestrated by
 * the calling app.
 */
export const createDeviceLogin = ({
	provider,
	tokenManager,
	clientId,
	scope,
	resource,
}: ICreateDeviceLoginParams) => {
	return async (options: IRunDeviceLoginOptions = {}) => {
		const codeVerifier = createRandomString();
		const codeChallenge = await createCodeChallenge(codeVerifier);

		const init = await provider.startDeviceCode({
			client_id: clientId,
			scope,
			resource,
			code_challenge: codeChallenge,
			code_challenge_method: 'S256',
		});

		const verificationUriComplete =
			init.verification_uri_complete ?? init.verification_uri;

		options.onUserPrompt?.({
			userCode: init.user_code,
			verificationUri: init.verification_uri,
			verificationUriComplete,
			expiresIn: init.expires_in,
		});

		if (options.onVerificationUri) {
			await options.onVerificationUri(verificationUriComplete);
		}

		const wireTokens = await pollDeviceToken({
			provider,
			deviceCode: init.device_code,
			clientId,
			codeVerifier,
			initialIntervalSec: init.interval,
			expiresInSec: init.expires_in,
			signal: options.signal,
		});

		tokenManager.store(wireTokenResponseToStored(wireTokens));
	};
};
