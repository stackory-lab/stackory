import { oauthProvider } from '@better-auth/oauth-provider';
import { betterAuth } from 'better-auth';
import { type MemoryDB, memoryAdapter } from 'better-auth/adapters/memory';
import { jwt } from 'better-auth/plugins';
import { describe, expect, it } from 'vitest';
import { DEVICE_CODE_GRANT_TYPE } from '../../../shared/constants';
import { deviceFlowPlugin } from '../device-flow.plugin';
import {
	type IInterceptFn,
	interceptingMemoryAdapter,
} from './__helpers__/intercepting-adapter';

const BASE_URL = 'https://auth.example.com/api/auth';
const CLIENT_ID = 'swarm-cli';

const createHarness = async (options?: {
	issueAuthorizationCode?: () => Promise<string>;
	intercept?: IInterceptFn;
}) => {
	const now = new Date();
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
				scopes: ['openid'],
				resource: ['https://api.example.com'],
				codeChallenge: 'challenge',
				codeChallengeMethod: 'S256',
				status: 'pending',
				pollInterval: 5,
				expiresAt: new Date(Date.now() + 60_000),
				createdAt: now,
			},
		],
	};
	const auth = betterAuth({
		baseURL: BASE_URL,
		secret: 'abcdefghijklmnopqrstuvwxyz123456',
		database: options?.intercept
			? interceptingMemoryAdapter(db, options.intercept)
			: memoryAdapter(db),
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
				verificationUri: 'https://web.example.com/device',
				allowedClientIds: [CLIENT_ID],
				defaultResources: ['https://api.example.com'],
				validResources: ['https://api.example.com'],
				issueAuthorizationCode:
					options?.issueAuthorizationCode ?? (async () => 'authorization-code'),
			}),
		],
	});
	const signUpResponse = await auth.api.signUpEmail({
		body: {
			email: 'device-user@example.com',
			password: 'password123',
			name: 'Device User',
		},
		asResponse: true,
	});
	const sessionCookie = signUpResponse.headers.get('set-cookie')?.split(';')[0];
	if (!sessionCookie) {
		throw new Error('signUpEmail did not return a session cookie');
	}

	return { auth, db, sessionCookie };
};

const decisionRequest = (path: string, sessionCookie: string) => {
	return new Request(`${BASE_URL}${path}`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			cookie: sessionCookie,
		},
		body: JSON.stringify({
			user_code: 'ABCD-EFGH',
		}),
	});
};

describe('device decision endpoints', () => {
	it('approves pending rows and stores the authorization code', async () => {
		const { auth, db, sessionCookie } = await createHarness();

		const response = await auth.handler(
			decisionRequest('/device/approve', sessionCookie),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: 'approved' });
		expect(db.deviceAuthorization[0]).toMatchObject({
			status: 'approved',
			authorizationCode: 'authorization-code',
			userId: db.user[0]?.id,
			scopes: ['openid'],
			resource: ['https://api.example.com'],
		});
		expect(db.deviceAuthorization[0]?.approvingStartedAt).toBeInstanceOf(Date);
		expect(db.deviceAuthorization[0]?.decidedAt).toBeInstanceOf(Date);
	});

	it('marks pending rows as denied', async () => {
		const { auth, db, sessionCookie } = await createHarness();

		const response = await auth.handler(
			decisionRequest('/device/deny', sessionCookie),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: 'denied' });
		expect(db.deviceAuthorization[0]).toMatchObject({
			status: 'denied',
		});
		expect(db.deviceAuthorization[0]?.decidedAt).toBeInstanceOf(Date);
	});

	it('moves approving rows to failed when authorization code issuance fails', async () => {
		const { auth, db, sessionCookie } = await createHarness({
			issueAuthorizationCode: async () => {
				throw new Error('issuer unavailable');
			},
		});

		const response = await auth.handler(
			decisionRequest('/device/approve', sessionCookie),
		);

		expect(response.status).toBe(500);
		expect(db.deviceAuthorization[0]).toMatchObject({
			status: 'failed',
			failureReason: 'issuer unavailable',
		});
		expect(db.deviceAuthorization[0]?.failedAt).toBeInstanceOf(Date);
		expect(db.deviceAuthorization[0]?.decidedAt).toBeUndefined();
		expect(db.deviceAuthorization[0]?.consumedAt).toBeUndefined();
	});

	it('returns 409 concurrent_decision when the pending → approving CAS loses', async () => {
		const { auth, db, sessionCookie } = await createHarness({
			intercept: (call) => {
				if (
					call.model === 'deviceAuthorization' &&
					call.update.status === 'approving' &&
					call.where.some((w) => w.field === 'status' && w.value === 'pending')
				) {
					return 0;
				}
				return undefined;
			},
		});

		const response = await auth.handler(
			decisionRequest('/device/approve', sessionCookie),
		);

		expect(response.status).toBe(409);
		const body = (await response.json()) as { error?: string };
		expect(body.error).toBe('concurrent_decision');
		expect(db.deviceAuthorization[0]?.status).toBe('pending');
	});

	it('returns 409 state_changed when the terminal approving → approved CAS misses', async () => {
		let captured: { db?: MemoryDB } = {};
		const harness = await createHarness({
			issueAuthorizationCode: async () => {
				if (captured.db?.deviceAuthorization?.[0]) {
					captured.db.deviceAuthorization[0].status = 'expired';
				}
				return 'authorization-code';
			},
		});
		captured = { db: harness.db };

		const response = await harness.auth.handler(
			decisionRequest('/device/approve', harness.sessionCookie),
		);

		expect(response.status).toBe(409);
		const body = (await response.json()) as { error?: string };
		expect(body.error).toBe('state_changed');
		expect(harness.db.deviceAuthorization[0]?.status).toBe('expired');
		expect(
			harness.db.deviceAuthorization[0]?.authorizationCode,
		).toBeUndefined();
		expect(harness.db.deviceAuthorization[0]?.decidedAt).toBeUndefined();
	});

	it('does not overwrite the row when the rollback approving → failed CAS misses', async () => {
		let captured: { db?: MemoryDB } = {};
		const harness = await createHarness({
			issueAuthorizationCode: async () => {
				if (captured.db?.deviceAuthorization?.[0]) {
					captured.db.deviceAuthorization[0].status = 'expired';
				}
				throw new Error('issuer unavailable');
			},
		});
		captured = { db: harness.db };

		const response = await harness.auth.handler(
			decisionRequest('/device/approve', harness.sessionCookie),
		);

		expect(response.status).toBe(500);
		expect(harness.db.deviceAuthorization[0]?.status).toBe('expired');
		expect(harness.db.deviceAuthorization[0]?.failedAt).toBeUndefined();
		expect(harness.db.deviceAuthorization[0]?.failureReason).toBeUndefined();
	});
});
