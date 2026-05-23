import { oauthProvider } from '@better-auth/oauth-provider';
import { betterAuth } from 'better-auth';
import { type MemoryDB, memoryAdapter } from 'better-auth/adapters/memory';
import { jwt } from 'better-auth/plugins';
import { describe, expect, it } from 'vitest';
import { DEVICE_CODE_GRANT_TYPE } from '../../../shared/constants';
import { deviceFlowPlugin } from '../device-flow.plugin';

const BASE_URL = 'https://auth.example.com/api/auth';
const CLIENT_ID = 'swarm-cli';

const createHarness = () => {
	const db: MemoryDB = {
		user: [],
		session: [],
		account: [],
		verification: [],
		jwks: [],
		oauthClient: [
			{
				clientId: CLIENT_ID,
				clientSecret: null,
				disabled: false,
				grantTypes: ['authorization_code', DEVICE_CODE_GRANT_TYPE],
				name: CLIENT_ID,
				public: true,
				redirectUris: ['urn:ietf:wg:oauth:2.0:oob'],
				responseTypes: ['code'],
				scopes: ['openid', 'profile'],
				tokenEndpointAuthMethod: 'none',
				type: 'public',
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		],
		oauthAccessToken: [],
		oauthRefreshToken: [],
		oauthConsent: [],
		deviceAuthorization: [],
	};
	const auth = betterAuth({
		baseURL: BASE_URL,
		secret: 'abcdefghijklmnopqrstuvwxyz123456',
		database: memoryAdapter(db),
		plugins: [
			jwt({
				disableSettingJwtHeader: true,
				jwt: {
					issuer: BASE_URL,
					expirationTime: '30m',
				},
			}),
			oauthProvider({
				loginPage: 'https://web.example.com/auth/sign-in',
				consentPage: 'https://web.example.com/auth/consent',
				silenceWarnings: {
					oauthAuthServerConfig: true,
					openidConfig: true,
				},
			}),
			deviceFlowPlugin({
				allowedClientIds: [CLIENT_ID],
				defaultResources: ['https://api.example.com'],
				validResources: ['https://api.example.com'],
				verificationUri: 'https://web.example.com/device',
			}),
		],
	});

	return { auth, db };
};

describe('deviceCode endpoint', () => {
	it('creates a pending device authorization row with RFC wire response', async () => {
		const { auth, db } = createHarness();

		const response = await auth.handler(
			new Request(`${BASE_URL}/device/code`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					client_id: CLIENT_ID,
					scope: 'openid profile email',
					resource: 'https://api.example.com',
					code_challenge: 'challenge',
					code_challenge_method: 'S256',
				}),
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			device_code?: string;
			user_code?: string;
			verification_uri?: string;
			verification_uri_complete?: string;
			expires_in?: number;
			interval?: number;
		};
		expect(body.device_code).toEqual(expect.any(String));
		expect(body.user_code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
		expect(body.verification_uri).toBe('https://web.example.com/device');
		expect(body.verification_uri_complete).toContain('user_code=');
		expect(body.expires_in).toBe(600);
		expect(body.interval).toBe(5);
		expect(db.deviceAuthorization).toHaveLength(1);
		expect(db.deviceAuthorization[0]).toMatchObject({
			clientId: CLIENT_ID,
			scopes: ['openid', 'profile'],
			resource: ['https://api.example.com'],
			codeChallenge: 'challenge',
			codeChallengeMethod: 'S256',
			status: 'pending',
			pollInterval: 5,
		});
	});

	it('falls back to client scopes when no scope parameter is provided', async () => {
		const { auth, db } = createHarness();

		const response = await auth.handler(
			new Request(`${BASE_URL}/device/code`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					client_id: CLIENT_ID,
					resource: 'https://api.example.com',
					code_challenge: 'challenge',
					code_challenge_method: 'S256',
				}),
			}),
		);

		expect(response.status).toBe(200);
		expect(db.deviceAuthorization[0]).toMatchObject({
			scopes: ['openid', 'profile'],
		});
	});

	it('rejects code_challenge_method other than S256', async () => {
		const { auth, db } = createHarness();

		const response = await auth.handler(
			new Request(`${BASE_URL}/device/code`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					client_id: CLIENT_ID,
					code_challenge: 'challenge',
					code_challenge_method: 'plain',
				}),
			}),
		);

		expect(response.status).toBe(400);
		expect(db.deviceAuthorization).toHaveLength(0);
	});

	it('rejects clients outside the device allowlist', async () => {
		const { auth, db } = createHarness();

		const response = await auth.handler(
			new Request(`${BASE_URL}/device/code`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					client_id: 'other-client',
					code_challenge: 'challenge',
					code_challenge_method: 'S256',
				}),
			}),
		);

		expect(response.status).toBe(400);
		const body = (await response.json()) as { error?: string };
		expect(body.error).toBe('unauthorized_client');
		expect(db.deviceAuthorization).toHaveLength(0);
	});
});
