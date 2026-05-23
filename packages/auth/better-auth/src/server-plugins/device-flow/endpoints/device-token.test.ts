import { betterAuth } from 'better-auth';
import { type MemoryDB, memoryAdapter } from 'better-auth/adapters/memory';
import { describe, expect, it } from 'vitest';
import { DEVICE_CODE_GRANT_TYPE } from '../../../shared/constants';
import { deviceFlowPlugin } from '../device-flow.plugin';
import { hashDeviceCode } from '../helpers/codes';
import type { IAccessTokenResponse } from '../types';
import {
	type IInterceptFn,
	interceptingMemoryAdapter,
} from './__helpers__/intercepting-adapter';

const BASE_URL = 'https://auth.example.com/api/auth';
const CLIENT_ID = 'swarm-cli';
const DEVICE_CODE = 'device-code';

const tokenResponse: IAccessTokenResponse = {
	access_token: 'access-token',
	token_type: 'Bearer',
	expires_in: 3600,
	refresh_token: 'refresh-token',
	scope: 'openid',
};

const createHarness = async (
	row: Record<string, unknown>,
	pluginOptions?: {
		issueAccessToken?: () => Promise<IAccessTokenResponse>;
		intercept?: IInterceptFn;
	},
) => {
	const db: MemoryDB = {
		user: [],
		session: [],
		account: [],
		verification: [],
		jwks: [],
		oauthClient: [],
		oauthAccessToken: [],
		oauthRefreshToken: [],
		oauthConsent: [],
		deviceAuthorization: [
			{
				id: 'device-row',
				deviceCodeHash: await hashDeviceCode(DEVICE_CODE),
				userCode: 'ABCDEFGH',
				clientId: CLIENT_ID,
				scopes: ['openid'],
				resource: ['https://api.example.com'],
				codeChallenge: 'challenge',
				codeChallengeMethod: 'S256',
				status: 'pending',
				pollInterval: 5,
				expiresAt: new Date(Date.now() + 60_000),
				createdAt: new Date(),
				...row,
			},
		],
	};
	const auth = betterAuth({
		baseURL: BASE_URL,
		secret: 'abcdefghijklmnopqrstuvwxyz123456',
		database: pluginOptions?.intercept
			? interceptingMemoryAdapter(db, pluginOptions.intercept)
			: memoryAdapter(db),
		plugins: [
			deviceFlowPlugin({
				verificationUri: 'https://web.example.com/device',
				issueAccessToken:
					pluginOptions?.issueAccessToken ?? (async () => tokenResponse),
			}),
		],
	});

	return { auth, db };
};

const tokenRequest = () => {
	return new Request(`${BASE_URL}/device/token`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
		},
		body: JSON.stringify({
			grant_type: DEVICE_CODE_GRANT_TYPE,
			device_code: DEVICE_CODE,
			client_id: CLIENT_ID,
			code_verifier: 'verifier',
		}),
	});
};

describe('deviceToken endpoint', () => {
	it('returns authorization_pending for pending rows', async () => {
		const { auth } = await createHarness({});

		const response = await auth.handler(tokenRequest());

		expect(response.status).toBe(400);
		const body = (await response.json()) as { error?: string };
		expect(body.error).toBe('authorization_pending');
	});

	it('exchanges approved rows for tokens and marks consumed', async () => {
		const { auth, db } = await createHarness({
			status: 'approved',
			authorizationCode: 'authorization-code',
		});

		const response = await auth.handler(tokenRequest());

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(tokenResponse);
		expect(db.deviceAuthorization[0]).toMatchObject({
			status: 'consumed',
			authorizationCode: null,
		});
		expect(db.deviceAuthorization[0]?.consumedAt).toBeInstanceOf(Date);
		expect(db.deviceAuthorization[0]?.failedAt).toBeUndefined();
	});

	it('marks the row as failed when token issuance throws', async () => {
		const { auth, db } = await createHarness(
			{ status: 'approved', authorizationCode: 'authorization-code' },
			{
				issueAccessToken: async () => {
					throw new Error('upstream down');
				},
			},
		);

		const response = await auth.handler(tokenRequest());

		expect(response.status).toBe(400);
		const body = (await response.json()) as { error?: string };
		expect(body.error).toBe('invalid_grant');
		expect(db.deviceAuthorization[0]).toMatchObject({
			status: 'failed',
			failureReason: 'upstream down',
		});
		expect(db.deviceAuthorization[0]?.failedAt).toBeInstanceOf(Date);
		expect(db.deviceAuthorization[0]?.consumedAt).toBeUndefined();
	});

	it('returns temporarily_unavailable when no issuer is configured', async () => {
		const db: MemoryDB = {
			user: [],
			session: [],
			account: [],
			verification: [],
			jwks: [],
			oauthClient: [],
			oauthAccessToken: [],
			oauthRefreshToken: [],
			oauthConsent: [],
			deviceAuthorization: [
				{
					id: 'device-row',
					deviceCodeHash: await hashDeviceCode(DEVICE_CODE),
					userCode: 'ABCDEFGH',
					clientId: CLIENT_ID,
					scopes: ['openid'],
					resource: ['https://api.example.com'],
					codeChallenge: 'challenge',
					codeChallengeMethod: 'S256',
					status: 'approved',
					authorizationCode: 'authorization-code',
					pollInterval: 5,
					expiresAt: new Date(Date.now() + 60_000),
					createdAt: new Date(),
				},
			],
		};
		const auth = betterAuth({
			baseURL: BASE_URL,
			secret: 'abcdefghijklmnopqrstuvwxyz123456',
			database: memoryAdapter(db),
			plugins: [
				deviceFlowPlugin({
					verificationUri: 'https://web.example.com/device',
				}),
			],
		});

		const response = await auth.handler(tokenRequest());

		expect(response.status).toBe(400);
		const body = (await response.json()) as { error?: string };
		expect(body.error).toBe('temporarily_unavailable');
		expect(db.deviceAuthorization[0]?.status).toBe('approved');
	});

	it('does not expire consuming rows', async () => {
		const { auth, db } = await createHarness({
			status: 'consuming',
			expiresAt: new Date(Date.now() - 60_000),
		});

		const response = await auth.handler(tokenRequest());

		expect(response.status).toBe(400);
		const body = (await response.json()) as { error?: string };
		expect(body.error).toBe('invalid_grant');
		expect(db.deviceAuthorization[0]?.status).toBe('consuming');
	});

	it('returns invalid_grant when the approved → consuming CAS loses', async () => {
		const { auth, db } = await createHarness(
			{
				status: 'approved',
				authorizationCode: 'authorization-code',
			},
			{
				intercept: (call) => {
					if (
						call.model === 'deviceAuthorization' &&
						call.update.status === 'consuming' &&
						call.where.some(
							(w) => w.field === 'status' && w.value === 'approved',
						)
					) {
						return 0;
					}
					return undefined;
				},
			},
		);

		const response = await auth.handler(tokenRequest());

		expect(response.status).toBe(400);
		const body = (await response.json()) as { error?: string };
		expect(body.error).toBe('invalid_grant');
		expect(db.deviceAuthorization[0]?.status).toBe('approved');
	});

	it('does not return tokens when the terminal consuming → consumed CAS misses', async () => {
		let dbRef: MemoryDB | undefined;
		const { auth, db } = await createHarness(
			{
				status: 'approved',
				authorizationCode: 'authorization-code',
			},
			{
				issueAccessToken: async () => {
					if (dbRef?.deviceAuthorization?.[0]) {
						dbRef.deviceAuthorization[0].status = 'expired';
					}
					return tokenResponse;
				},
			},
		);
		dbRef = db;

		const response = await auth.handler(tokenRequest());

		expect(response.status).toBe(400);
		const body = (await response.json()) as { error?: string };
		expect(body.error).toBe('invalid_grant');
		expect(db.deviceAuthorization[0]?.status).toBe('expired');
		expect(db.deviceAuthorization[0]?.consumedAt).toBeUndefined();
	});

	it('marks failed and returns invalid_grant when token issuance throws after race-mutated row', async () => {
		let dbRef: MemoryDB | undefined;
		const { auth, db } = await createHarness(
			{
				status: 'approved',
				authorizationCode: 'authorization-code',
			},
			{
				issueAccessToken: async () => {
					if (dbRef?.deviceAuthorization?.[0]) {
						dbRef.deviceAuthorization[0].status = 'expired';
					}
					throw new Error('upstream down');
				},
			},
		);
		dbRef = db;

		const response = await auth.handler(tokenRequest());

		expect(response.status).toBe(400);
		const body = (await response.json()) as { error?: string };
		expect(body.error).toBe('invalid_grant');
		expect(db.deviceAuthorization[0]?.status).toBe('expired');
		expect(db.deviceAuthorization[0]?.failedAt).toBeUndefined();
		expect(db.deviceAuthorization[0]?.failureReason).toBeUndefined();
		expect(db.deviceAuthorization[0]?.consumedAt).toBeUndefined();
	});
});
