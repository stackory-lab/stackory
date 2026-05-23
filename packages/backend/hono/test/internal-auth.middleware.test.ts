import {
	buildSignedInternalHeadersString,
	computeInternalSignature,
} from '@stackory/backend-utils';
import { error } from '@stackory/constants';
import type { ErrorHandler } from 'hono';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createInternalAuthMiddleware } from '../src/middleware/internal-auth.middleware';

const { errorCode, StandardError } = error;

// Test-specific error handler that returns proper status codes
const testErrorHandler: ErrorHandler = (err, c) => {
	if (err instanceof StandardError) {
		return c.json({ code: err.code, message: err.message }, 401);
	}
	return c.json({ code: errorCode.INTERNAL_SERVER_ERROR, message: 'Internal Server Error' }, 500);
};

describe('createInternalAuthMiddleware', () => {
	const testSecret = 'test-secret-key-12345';

	const createTestApp = (secret: string | undefined) => {
		const app = new Hono();
		app.use(
			'*',
			createInternalAuthMiddleware({
				getSecret: () => secret as string,
			}),
		);
		app.get('/test', (c) => c.json({ success: true }));
		app.post('/test', (c) => c.json({ success: true }));
		app.onError(testErrorHandler);
		return app;
	};

	const createAuthenticatedRequest = async (
		method: string,
		path: string,
		body?: Record<string, unknown>,
	) => {
		const timestamp = Date.now().toString();
		const bodyStr = body ? JSON.stringify(body) : '';
		const signature = await computeInternalSignature({
			secret: testSecret,
			method,
			path,
			timestamp,
			bodyStr,
			headersStr: ''
		});

		const headers: Record<string, string> = {
			'X-Internal-Signature': signature,
			'X-Internal-Timestamp': timestamp,
		};

		if (body) {
			headers['Content-Type'] = 'application/json';
		}

		return new Request(`http://localhost${path}`, {
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined,
		});
	};

	it('should allow requests with valid signature', async () => {
		const app = createTestApp(testSecret);
		const req = await createAuthenticatedRequest('GET', '/test');
		const res = await app.request(req);

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ success: true });
	});

	it('should reject requests when secret is missing', async () => {
		const app = createTestApp(undefined);
		const req = await createAuthenticatedRequest('GET', '/test');
		const res = await app.request(req);

		expect(res.status).toBe(401);
		const data = (await res.json()) as { code: string };
		expect(data.code).toBe(errorCode.AUTH_INTERNAL_MISSING);
	});

	it('should reject requests with missing signature header', async () => {
		const app = createTestApp(testSecret);
		const req = new Request('http://localhost/test', {
			headers: {
				'X-Internal-Timestamp': Date.now().toString(),
			},
		});
		const res = await app.request(req);

		expect(res.status).toBe(401);
		const data = (await res.json()) as { code: string };
		expect(data.code).toBe(errorCode.AUTH_INTERNAL_MISSING);
	});

	it('should reject requests with missing timestamp header', async () => {
		const app = createTestApp(testSecret);
		const req = new Request('http://localhost/test', {
			headers: {
				'X-Internal-Signature': 'some-signature',
			},
		});
		const res = await app.request(req);

		expect(res.status).toBe(401);
		const data = (await res.json()) as { code: string };
		expect(data.code).toBe(errorCode.AUTH_INTERNAL_MISSING);
	});

	it('should reject requests with expired timestamp', async () => {
		const app = createTestApp(testSecret);
		const oldTimestamp = (Date.now() - 120000).toString(); // 2 minutes ago
		const signature = await computeInternalSignature({
			secret: testSecret,
			method: 'GET',
			path: '/test',
			timestamp: oldTimestamp,
			bodyStr: '',
			headersStr: ''
		});

		const req = new Request('http://localhost/test', {
			headers: {
				'X-Internal-Signature': signature,
				'X-Internal-Timestamp': oldTimestamp,
			},
		});
		const res = await app.request(req);

		expect(res.status).toBe(401);
		const data = (await res.json()) as { code: string };
		expect(data.code).toBe(errorCode.AUTH_INTERNAL_EXPIRED);
	});

	it('should reject requests with invalid signature', async () => {
		const app = createTestApp(testSecret);
		const req = new Request('http://localhost/test', {
			headers: {
				'X-Internal-Signature': 'invalid-signature',
				'X-Internal-Timestamp': Date.now().toString(),
			},
		});
		const res = await app.request(req);

		expect(res.status).toBe(401);
		const data = (await res.json()) as { code: string };
		expect(data.code).toBe(errorCode.AUTH_INTERNAL_SIG_ERROR);
	});

	it('should handle POST requests with body', async () => {
		const app = createTestApp(testSecret);
		const body = { test: 'data' };
		const req = await createAuthenticatedRequest('POST', '/test', body);
		const res = await app.request(req);

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ success: true });
	});

	it('should verify signed auth context headers', async () => {
		const app = createTestApp(testSecret);
		const timestamp = Date.now().toString();
		const headers = new Headers({
			'X-Auth-Aud': 'https://api.staging.agentgroup.app/agent-mcp/mcp',
			'X-Auth-Client-Id': 'swarm-cli',
			'X-Auth-Scope': 'openid profile email offline_access',
			'X-Auth-Sub': 'user-123',
			'X-User-Id': 'user-123',
		});
		const signature = await computeInternalSignature({
			secret: testSecret,
			method: 'GET',
			path: '/test',
			timestamp,
			bodyStr: '',
			headersStr: buildSignedInternalHeadersString(headers),
		});

		headers.set('X-Internal-Signature', signature);
		headers.set('X-Internal-Timestamp', timestamp);

		const res = await app.request(
			new Request('http://localhost/test', {
				method: 'GET',
				headers,
			}),
		);

		expect(res.status).toBe(200);
	});

	it('should reject requests when signed auth context headers are tampered', async () => {
		const app = createTestApp(testSecret);
		const timestamp = Date.now().toString();
		const signature = await computeInternalSignature({
			secret: testSecret,
			method: 'GET',
			path: '/test',
			timestamp,
			bodyStr: '',
			headersStr: buildSignedInternalHeadersString(
				new Headers({
					'X-Auth-Client-Id': 'swarm-cli',
				}),
			),
		});
		const req = new Request('http://localhost/test', {
			method: 'GET',
			headers: {
				'X-Auth-Client-Id': 'another-client',
				'X-Internal-Signature': signature,
				'X-Internal-Timestamp': timestamp,
			},
		});

		const res = await app.request(req);

		expect(res.status).toBe(401);
		const data = (await res.json()) as { code: string };
		expect(data.code).toBe(errorCode.AUTH_INTERNAL_SIG_ERROR);
	});

	it('should respect custom maxTimeDiff option', async () => {
		const app = new Hono();
		app.use(
			'*',
			createInternalAuthMiddleware({
				getSecret: () => testSecret,
				maxTimeDiff: 30000, // 30 seconds
			}),
		);
		app.get('/test', (c) => c.json({ success: true }));
		app.onError(testErrorHandler);

		const oldTimestamp = (Date.now() - 45000).toString(); // 45 seconds ago
		const signature = await computeInternalSignature({
			secret: testSecret,
			method: 'GET',
			path: '/test',
			timestamp: oldTimestamp,
			bodyStr: '',
	    headersStr: ''
		});

		const req = new Request('http://localhost/test', {
			headers: {
				'X-Internal-Signature': signature,
				'X-Internal-Timestamp': oldTimestamp,
			},
		});
		const res = await app.request(req);

		expect(res.status).toBe(401);
		const data = (await res.json()) as { code: string };
		expect(data.code).toBe(errorCode.AUTH_INTERNAL_EXPIRED);
	});

	it('should handle async getSecret function', async () => {
		const app = new Hono();
		app.use(
			'*',
			createInternalAuthMiddleware({
				getSecret: async () => {
					// Simulate async operation
					await new Promise((resolve) => setTimeout(resolve, 10));
					return testSecret;
				},
			}),
		);
		app.get('/test', (c) => c.json({ success: true }));
		app.onError(testErrorHandler);

		const req = await createAuthenticatedRequest('GET', '/test');
		const res = await app.request(req);

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toEqual({ success: true });
	});

	it('should handle getSecret throwing an error', async () => {
		const app = new Hono();
		app.use(
			'*',
			createInternalAuthMiddleware({
				getSecret: () => {
					throw new Error('Secret retrieval failed');
				},
			}),
		);
		app.get('/test', (c) => c.json({ success: true }));
		app.onError(testErrorHandler);

		const req = await createAuthenticatedRequest('GET', '/test');
		const res = await app.request(req);

		expect(res.status).toBe(401);
		const data = (await res.json()) as { code: string; message: string };
		expect(data.code).toBe(errorCode.AUTH_INTERNAL_MISSING);
		expect(data.message).toContain('Secret retrieval failed');
	});

	it('should skip authentication for paths matching ignorePaths patterns', async () => {
		const app = new Hono();
		app.use(
			'*',
			createInternalAuthMiddleware({
				getSecret: () => testSecret,
				ignorePaths: [/^\/public\//, /^\/health$/],
			}),
		);
		app.get('/public/info', (c) => c.json({ public: true }));
		app.get('/health', (c) => c.json({ status: 'ok' }));
		app.get('/private', (c) => c.json({ private: true }));
		app.onError(testErrorHandler);

		// Test /public/* routes (no auth required)
		const publicReq = new Request('http://localhost/public/info');
		const publicRes = await app.request(publicReq);
		expect(publicRes.status).toBe(200);
		const publicData = await publicRes.json();
		expect(publicData).toEqual({ public: true });

		// Test /health route (no auth required)
		const healthReq = new Request('http://localhost/health');
		const healthRes = await app.request(healthReq);
		expect(healthRes.status).toBe(200);
		const healthData = await healthRes.json();
		expect(healthData).toEqual({ status: 'ok' });

		// Test /private route (auth required, should fail without signature)
		const privateReq = new Request('http://localhost/private');
		const privateRes = await app.request(privateReq);
		expect(privateRes.status).toBe(401);
		const privateData = (await privateRes.json()) as { code: string };
		expect(privateData.code).toBe(errorCode.AUTH_INTERNAL_MISSING);
	});

	it('should authenticate normally when ignorePaths is empty', async () => {
		const app = new Hono();
		app.use(
			'*',
			createInternalAuthMiddleware({
				getSecret: () => testSecret,
				ignorePaths: [],
			}),
		);
		app.get('/test', (c) => c.json({ success: true }));
		app.onError(testErrorHandler);

		// Without auth headers should fail
		const reqWithoutAuth = new Request('http://localhost/test');
		const resWithoutAuth = await app.request(reqWithoutAuth);
		expect(resWithoutAuth.status).toBe(401);

		// With valid auth should succeed
		const reqWithAuth = await createAuthenticatedRequest('GET', '/test');
		const resWithAuth = await app.request(reqWithAuth);
		expect(resWithAuth.status).toBe(200);
	});

	it('should work when ignorePaths is not provided', async () => {
		const app = new Hono();
		app.use(
			'*',
			createInternalAuthMiddleware({
				getSecret: () => testSecret,
			}),
		);
		app.get('/test', (c) => c.json({ success: true }));
		app.onError(testErrorHandler);

		const req = await createAuthenticatedRequest('GET', '/test');
		const res = await app.request(req);
		expect(res.status).toBe(200);
	});
});
