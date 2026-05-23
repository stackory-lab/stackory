import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from '../index';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const jsonRes = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});

const textRes = (body: string, status = 200) =>
	new Response(body, {
		status,
		headers: { 'Content-Type': 'text/plain' },
	});

// Return a new Response instance on every call to avoid stream-exhaustion
const mockFetchWith = (factory: () => Response) => () =>
	Promise.resolve(factory());

// ─── Setup ───────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

// ─── ApiError ────────────────────────────────────────────────────────────────

describe('ApiError', () => {
	it('carries status and data', () => {
		const err = new ApiError(404, { message: 'not found' });
		expect(err.status).toBe(404);
		expect(err.data).toEqual({ message: 'not found' });
	});

	it('formats message as "API error <status>"', () => {
		expect(new ApiError(500, null).message).toBe('API error 500');
	});

	it('has name "ApiError"', () => {
		expect(new ApiError(400, null).name).toBe('ApiError');
	});

	it('is an instanceof Error and ApiError', () => {
		const err = new ApiError(422, null);
		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(ApiError);
	});
});

// ─── createApiClient ─────────────────────────────────────────────────────────

describe('createApiClient', () => {
	describe('response parsing', () => {
		it('returns parsed JSON for application/json responses', async () => {
			mockFetch.mockImplementation(mockFetchWith(() => jsonRes({ id: 1 })));
			const client = createApiClient();
			const result = await client<{ id: number }>(
				'https://api.example.com/item',
			);
			expect(result).toEqual({ id: 1 });
		});

		it('returns raw text for non-JSON responses', async () => {
			mockFetch.mockImplementation(mockFetchWith(() => textRes('hello')));
			const client = createApiClient();
			const result = await client<string>('https://api.example.com/text');
			expect(result).toBe('hello');
		});
	});

	describe('error handling', () => {
		it('throws ApiError on 4xx', async () => {
			mockFetch.mockImplementation(
				mockFetchWith(() => jsonRes({ error: 'not found' }, 404)),
			);
			const client = createApiClient();
			const err = await client('https://api.example.com/missing').catch(
				(e: unknown) => e,
			);
			expect(err).toBeInstanceOf(ApiError);
			expect((err as ApiError).status).toBe(404);
			expect((err as ApiError).data).toEqual({ error: 'not found' });
		});

		it('throws ApiError on 5xx', async () => {
			mockFetch.mockImplementation(
				mockFetchWith(() => jsonRes({ error: 'server error' }, 500)),
			);
			const client = createApiClient();
			const err = await client('https://api.example.com/fail').catch(
				(e: unknown) => e,
			);
			expect(err).toBeInstanceOf(ApiError);
			expect((err as ApiError).status).toBe(500);
		});
	});

	describe('baseUrl', () => {
		it('resolves relative path against baseUrl', async () => {
			mockFetch.mockImplementation(mockFetchWith(() => jsonRes({})));
			const client = createApiClient({ baseUrl: 'https://api.example.com' });
			await client('/users');
			const req: Request = mockFetch.mock.calls[0][0];
			expect(req.url).toBe('https://api.example.com/users');
		});

		it('preserves query string when resolving URL', async () => {
			mockFetch.mockImplementation(mockFetchWith(() => jsonRes({})));
			const client = createApiClient({ baseUrl: 'https://api.example.com' });
			await client('/search?q=foo');
			const req: Request = mockFetch.mock.calls[0][0];
			expect(req.url).toBe('https://api.example.com/search?q=foo');
		});
	});

	describe('request init', () => {
		it('applies init when input is a Request', async () => {
			mockFetch.mockImplementation(mockFetchWith(() => jsonRes({})));
			const client = createApiClient();
			const abortController = new AbortController();

			await client(
				new Request('https://api.example.com/items', {
					headers: { 'X-Request': 'original' },
					method: 'POST',
				}),
				{
					signal: abortController.signal,
				},
			);

			const req: Request = mockFetch.mock.calls[0][0];
			expect(req.headers.get('X-Request')).toBe('original');
			expect(req.method).toBe('POST');
			abortController.abort();
			expect(req.signal.aborted).toBe(true);
		});
	});

	describe('beforeRequest hooks', () => {
		it('runs hooks in declaration order', async () => {
			mockFetch.mockImplementation(mockFetchWith(() => jsonRes({})));
			const order: number[] = [];
			const client = createApiClient({
				hooks: {
					beforeRequest: [
						(req) => {
							order.push(1);
							return req;
						},
						(req) => {
							order.push(2);
							return req;
						},
					],
				},
			});
			await client('https://api.example.com/');
			expect(order).toEqual([1, 2]);
		});

		it('hook can inject a request header', async () => {
			mockFetch.mockImplementation(mockFetchWith(() => jsonRes({})));
			const client = createApiClient({
				hooks: {
					beforeRequest: [
						(req) => {
							const headers = new Headers(req.headers);
							headers.set('Authorization', 'Bearer tok');
							return new Request(req, { headers });
						},
					],
				},
			});
			await client('https://api.example.com/');
			const sent: Request = mockFetch.mock.calls[0][0];
			expect(sent.headers.get('Authorization')).toBe('Bearer tok');
		});

		it('async hook is awaited before fetch', async () => {
			mockFetch.mockImplementation(mockFetchWith(() => jsonRes({})));
			let hookResolved = false;
			const client = createApiClient({
				hooks: {
					beforeRequest: [
						async (req) => {
							await Promise.resolve();
							hookResolved = true;
							return req;
						},
					],
				},
			});
			await client('https://api.example.com/');
			expect(hookResolved).toBe(true);
			expect(mockFetch).toHaveBeenCalledOnce();
		});
	});

	describe('afterResponse hooks', () => {
		it('hook can replace the response', async () => {
			mockFetch.mockImplementation(
				mockFetchWith(() => jsonRes({ original: true })),
			);
			const client = createApiClient({
				hooks: {
					afterResponse: [(_req, _res) => jsonRes({ replaced: true })],
				},
			});
			const result = await client<{ replaced: boolean }>(
				'https://api.example.com/',
			);
			expect(result).toEqual({ replaced: true });
		});

		it('hook can retry the request on 401', async () => {
			mockFetch
				.mockImplementationOnce(
					mockFetchWith(() => jsonRes({ error: 'unauthorized' }, 401)),
				)
				.mockImplementationOnce(mockFetchWith(() => jsonRes({ ok: true })));

			const client = createApiClient({
				hooks: {
					afterResponse: [
						async (req, res) => {
							if (res.status !== 401) return res;
							// Simulate token refresh + retry
							const headers = new Headers(req.headers);
							headers.set('Authorization', 'Bearer new-token');
							return fetch(new Request(req, { headers }));
						},
					],
				},
			});

			const result = await client<{ ok: boolean }>(
				'https://api.example.com/secure',
			);
			expect(result).toEqual({ ok: true });
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});
	});
});
