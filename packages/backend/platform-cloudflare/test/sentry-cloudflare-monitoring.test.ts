import { error } from '@stackory/constants';
import { describe, expect, it } from 'vitest';
import { shouldHandleSentryHonoError } from '../src/sentry-cloudflare-monitoring';

const { StandardError, errorCode } = error;

describe('shouldHandleSentryHonoError', () => {
	it('filters caller-side StandardError codes', () => {
		expect(
			shouldHandleSentryHonoError(
				new StandardError({
					code: errorCode.UNAUTHORIZED,
					message: 'Unauthorized',
				}),
			),
		).toBe(false);
		expect(
			shouldHandleSentryHonoError(
				new StandardError({
					code: errorCode.AUTH_INTERNAL_SIG_ERROR,
					message: 'Invalid signature',
				}),
			),
		).toBe(false);
	});

	it('captures receiver-side StandardError codes', () => {
		expect(
			shouldHandleSentryHonoError(
				new StandardError({
					code: errorCode.INTERNAL_SERVER_ERROR,
					message: 'Internal error',
				}),
			),
		).toBe(true);
		expect(
			shouldHandleSentryHonoError(
				new StandardError({
					code: errorCode.AUTH_JWKS_FETCH_FAILED,
					message: 'JWKS fetch failed',
				}),
			),
		).toBe(true);
	});

	it('keeps default Hono status filtering for non-StandardError values', () => {
		expect(
			shouldHandleSentryHonoError({
				status: 401,
			}),
		).toBe(false);
		expect(
			shouldHandleSentryHonoError({
				status: 503,
			}),
		).toBe(true);
		expect(shouldHandleSentryHonoError(new Error('boom'))).toBe(true);
	});
});
