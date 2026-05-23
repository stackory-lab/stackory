import { describe, expect, it, vi } from 'vitest';
import { AuthError, isAuthError } from './auth-error';
import {
	type IDeviceFlowProvider,
	type IDeviceTokenPollResult,
	pollDeviceToken,
} from './device-flow';
import type { IOAuthWireTokenResponse } from './token-mapping';

const TOKENS: IOAuthWireTokenResponse = {
	access_token: 'access-token',
	refresh_token: 'refresh-token',
	token_type: 'Bearer',
	expires_in: 3600,
	scope: 'openid',
};

const createProvider = (
	results: IDeviceTokenPollResult[],
): {
	provider: IDeviceFlowProvider;
	calls: Array<{ deviceCode: string; clientId: string }>;
} => {
	const calls: Array<{ deviceCode: string; clientId: string }> = [];
	let i = 0;
	return {
		calls,
		provider: {
			startDeviceCode: vi.fn(),
			exchangeToken: async (req) => {
				calls.push({ deviceCode: req.device_code, clientId: req.client_id });
				const result = results[i] ?? { tag: 'pending' as const };
				i += 1;
				return result;
			},
		},
	};
};

const advanceTimersAsync = async (ms: number) => {
	await vi.advanceTimersByTimeAsync(ms);
};

describe('pollDeviceToken', () => {
	it('returns tokens on first success', async () => {
		vi.useFakeTimers();
		const { provider, calls } = createProvider([
			{ tag: 'success', tokens: TOKENS },
		]);

		const promise = pollDeviceToken({
			provider,
			deviceCode: 'device-code',
			clientId: 'swarm-cli',
			initialIntervalSec: 5,
			expiresInSec: 600,
			now: () => Date.now(),
		});

		await expect(promise).resolves.toEqual(TOKENS);
		expect(calls).toEqual([
			{ deviceCode: 'device-code', clientId: 'swarm-cli' },
		]);
		vi.useRealTimers();
	});

	it('retries on pending, then succeeds after the interval', async () => {
		vi.useFakeTimers();
		const { provider, calls } = createProvider([
			{ tag: 'pending' },
			{ tag: 'success', tokens: TOKENS },
		]);

		const promise = pollDeviceToken({
			provider,
			deviceCode: 'device-code',
			clientId: 'swarm-cli',
			initialIntervalSec: 5,
			expiresInSec: 600,
			now: () => Date.now(),
		});

		await advanceTimersAsync(5_000);
		await expect(promise).resolves.toEqual(TOKENS);
		expect(calls).toHaveLength(2);
		vi.useRealTimers();
	});

	it('honors slow_down by bumping interval by 5s', async () => {
		vi.useFakeTimers();
		const { provider } = createProvider([
			{ tag: 'pending' },
			{ tag: 'slow_down' },
			{ tag: 'success', tokens: TOKENS },
		]);

		const promise = pollDeviceToken({
			provider,
			deviceCode: 'device-code',
			clientId: 'swarm-cli',
			initialIntervalSec: 5,
			expiresInSec: 600,
			now: () => Date.now(),
		});

		// pending → wait 5s
		await advanceTimersAsync(5_000);
		// slow_down → bump to 10s, wait 10s
		await advanceTimersAsync(10_000);
		await expect(promise).resolves.toEqual(TOKENS);
		vi.useRealTimers();
	});

	it('caps slow_down backoff at 30s', async () => {
		vi.useFakeTimers();
		const { provider } = createProvider([
			{ tag: 'slow_down' }, // 5 → 10
			{ tag: 'slow_down' }, // 10 → 15
			{ tag: 'slow_down' }, // 15 → 20
			{ tag: 'slow_down' }, // 20 → 25
			{ tag: 'slow_down' }, // 25 → 30
			{ tag: 'slow_down' }, // 30 → 30 (capped)
			{ tag: 'success', tokens: TOKENS },
		]);

		const promise = pollDeviceToken({
			provider,
			deviceCode: 'device-code',
			clientId: 'swarm-cli',
			initialIntervalSec: 5,
			expiresInSec: 600,
			now: () => Date.now(),
		});

		// 5 + 10 + 15 + 20 + 25 + 30 + 30 = 135s
		await advanceTimersAsync(140_000);
		await expect(promise).resolves.toEqual(TOKENS);
		vi.useRealTimers();
	});

	it('throws AuthError with oauthError=access_denied on denied', async () => {
		vi.useFakeTimers();
		const { provider } = createProvider([{ tag: 'denied' }]);

		const promise = pollDeviceToken({
			provider,
			deviceCode: 'device-code',
			clientId: 'swarm-cli',
			initialIntervalSec: 5,
			expiresInSec: 600,
			now: () => Date.now(),
		});

		await expect(promise).rejects.toMatchObject({
			kind: 'oauth',
			oauthError: 'access_denied',
		});
		vi.useRealTimers();
	});

	it('throws AuthError with oauthError=expired_token on server expired result', async () => {
		vi.useFakeTimers();
		const { provider } = createProvider([{ tag: 'expired' }]);

		const promise = pollDeviceToken({
			provider,
			deviceCode: 'device-code',
			clientId: 'swarm-cli',
			initialIntervalSec: 5,
			expiresInSec: 600,
			now: () => Date.now(),
		});

		await expect(promise).rejects.toMatchObject({
			kind: 'oauth',
			oauthError: 'expired_token',
		});
		vi.useRealTimers();
	});

	it('throws expired_token when local deadline passes before success', async () => {
		vi.useFakeTimers();
		let mockTime = 0;
		const provider: IDeviceFlowProvider = {
			startDeviceCode: vi.fn(),
			exchangeToken: async () => {
				mockTime += 6_000;
				return { tag: 'pending' as const };
			},
		};

		const promise = pollDeviceToken({
			provider,
			deviceCode: 'device-code',
			clientId: 'swarm-cli',
			initialIntervalSec: 5,
			expiresInSec: 10,
			now: () => mockTime,
		});
		// Attach a swallowing handler so the eventual rejection is always
		// handled — prevents Node's PromiseRejectionHandledWarning from
		// firing between `abort()` and the awaited expect below.
		const captured = promise.catch((err) => err);

		await advanceTimersAsync(15_000);
		const result = await captured;
		expect(result).toMatchObject({
			kind: 'oauth',
			oauthError: 'expired_token',
		});
		vi.useRealTimers();
	});

	it('propagates failed result with the upstream oauthError code', async () => {
		vi.useFakeTimers();
		const { provider } = createProvider([
			{
				tag: 'failed',
				oauthError: 'unauthorized_client',
				description: 'Client not allowed',
			},
		]);

		const promise = pollDeviceToken({
			provider,
			deviceCode: 'device-code',
			clientId: 'swarm-cli',
			initialIntervalSec: 5,
			expiresInSec: 600,
			now: () => Date.now(),
		});

		await expect(promise).rejects.toMatchObject({
			kind: 'oauth',
			oauthError: 'unauthorized_client',
			message: 'Client not allowed',
		});
		vi.useRealTimers();
	});

	it('honors AbortSignal mid-wait and throws cancelled', async () => {
		vi.useFakeTimers();
		const controller = new AbortController();
		const { provider } = createProvider([
			{ tag: 'pending' },
			{ tag: 'success', tokens: TOKENS },
		]);

		const promise = pollDeviceToken({
			provider,
			deviceCode: 'device-code',
			clientId: 'swarm-cli',
			initialIntervalSec: 5,
			expiresInSec: 600,
			signal: controller.signal,
			now: () => Date.now(),
		});
		const captured = promise.catch((err) => err);

		await advanceTimersAsync(1_000);
		controller.abort();
		await advanceTimersAsync(1);
		const result = await captured;
		expect(result).toMatchObject({ kind: 'cancelled' });
		vi.useRealTimers();
	});

	it('honors AbortSignal aborted before first poll', async () => {
		const controller = new AbortController();
		controller.abort();
		const { provider } = createProvider([{ tag: 'success', tokens: TOKENS }]);

		await expect(
			pollDeviceToken({
				provider,
				deviceCode: 'device-code',
				clientId: 'swarm-cli',
				initialIntervalSec: 5,
				expiresInSec: 600,
				signal: controller.signal,
				now: () => Date.now(),
			}),
		).rejects.toMatchObject({ kind: 'cancelled' });
	});

	it('all thrown errors are AuthError instances', async () => {
		vi.useFakeTimers();
		const { provider } = createProvider([{ tag: 'denied' }]);

		try {
			await pollDeviceToken({
				provider,
				deviceCode: 'device-code',
				clientId: 'swarm-cli',
				initialIntervalSec: 5,
				expiresInSec: 600,
				now: () => Date.now(),
			});
			expect.fail('should have thrown');
		} catch (err) {
			expect(isAuthError(err)).toBe(true);
			expect(err).toBeInstanceOf(AuthError);
		} finally {
			vi.useRealTimers();
		}
	});
});
