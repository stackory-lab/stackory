import { oauthProvider } from '@better-auth/oauth-provider';
import { betterAuth } from 'better-auth';
import { type MemoryDB, memoryAdapter } from 'better-auth/adapters/memory';
import { jwt } from 'better-auth/plugins';
import { describe, expect, it } from 'vitest';
import { DEVICE_CODE_GRANT_TYPE } from '../../../shared/constants';
import { deviceFlowPlugin } from '../device-flow.plugin';

const BASE_URL = 'https://auth.example.com/api/auth';
const CLIENT_ID = 'swarm-cli';

const createHarness = async () => {
	const now = new Date();
	const expiresAt = new Date(Date.now() + 60_000);
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
				icon: 'https://web.example.com/icon.png',
				name: 'Swarm CLI',
				public: true,
				redirectUris: ['urn:ietf:wg:oauth:2.0:oob'],
				responseTypes: ['code'],
				scopes: ['openid', 'profile'],
				tokenEndpointAuthMethod: 'none',
				type: 'public',
				createdAt: now,
				updatedAt: now,
			},
		],
		oauthAccessToken: [],
		oauthRefreshToken: [],
		oauthConsent: [],
		deviceAuthorization: [
			{
				id: 'device-row',
				deviceCodeHash: 'hash',
				userCode: 'ABCDEFGH',
				clientId: CLIENT_ID,
				scopes: ['openid', 'profile'],
				resource: ['https://api.example.com'],
				codeChallenge: 'challenge',
				codeChallengeMethod: 'S256',
				status: 'pending',
				pollInterval: 5,
				createdIp: '203.0.113.5',
				createdUa: 'swarm-cli/1.4.2',
				expiresAt,
				createdAt: now,
			},
		],
	};
	const auth = betterAuth({
		baseURL: BASE_URL,
		secret: 'abcdefghijklmnopqrstuvwxyz123456',
		database: memoryAdapter(db),
		emailAndPassword: {
			enabled: true,
		},
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
	const signUpResponse = await auth.api.signUpEmail({
		body: {
			email: 'device-info-user@example.com',
			password: 'password123',
			name: 'Device Info User',
		},
		asResponse: true,
	});
	const sessionCookie = signUpResponse.headers.get('set-cookie')?.split(';')[0];
	if (!sessionCookie) {
		throw new Error('signUpEmail did not return a session cookie');
	}

	return { auth, expiresAt, sessionCookie };
};

describe('device info and redirect endpoints', () => {
	it('returns pending device authorization display data', async () => {
		const { auth, expiresAt, sessionCookie } = await createHarness();

		const response = await auth.handler(
			new Request(`${BASE_URL}/device/info?user_code=ABCD-EFGH`, {
				headers: {
					cookie: sessionCookie,
				},
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			client: {
				client_id: CLIENT_ID,
				name: 'Swarm CLI',
				icon: 'https://web.example.com/icon.png',
			},
			scopes: ['openid', 'profile'],
			resource: ['https://api.example.com'],
			created_ip: '203.0.113.5',
			created_ua: 'swarm-cli/1.4.2',
			expires_at: expiresAt.toISOString(),
		});
	});

	it('rejects device info without a session', async () => {
		const { auth } = await createHarness();

		const response = await auth.handler(
			new Request(`${BASE_URL}/device/info?user_code=ABCD-EFGH`),
		);

		expect(response.status).toBe(401);
	});

	it('redirects browser visits to the configured verification page', async () => {
		const { auth } = await createHarness();

		const response = await auth.handler(
			new Request(`${BASE_URL}/device?user_code=ABCD-EFGH`),
		);

		expect(response.status).toBe(302);
		expect(response.headers.get('location')).toBe(
			'https://web.example.com/device?user_code=ABCD-EFGH',
		);
	});
});
