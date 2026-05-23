import {
	buildSignedInternalHeadersString,
	computeInternalSignature,
	SIGNATURE_SKIP_BODY_PAYLOAD,
} from '@stackory/backend-utils';
import { error } from '@stackory/constants';
import { cryptoUtils } from '@stackory/utils';
import type { Context, Env, MiddlewareHandler } from 'hono';

const { errorCode, StandardError } = error;

/**
 * Configuration options for internal authentication middleware
 *
 * @template E - The environment bindings type (e.g., Cloudflare Bindings)
 */
export interface InternalAuthOptions<E extends Env = any> {
	/**
	 * Function to retrieve the HMAC secret key from the context.
	 * This abstracts the secret retrieval logic, making the middleware
	 * runtime-agnostic (works with Cloudflare Workers, Node.js, Deno, etc.)
	 *
	 * @param c - Hono context object with typed environment bindings
	 * @returns The HMAC secret key as a string
	 * @throws Should throw or return null/undefined if the secret is unavailable
	 */
	getSecret: (c: Context<E>) => string | Promise<string>;

	/**
	 * Maximum allowed time difference in milliseconds between request timestamp
	 * and server time. This prevents replay attacks.
	 *
	 * @default 60000 (60 seconds)
	 */
	maxTimeDiff?: number;

	/**
	 * Array of regular expressions to match against request paths.
	 * If a path matches any of these patterns, authentication will be skipped.
	 *
	 * @example
	 * ignorePaths: [/^\/public\//, /^\/health$/]
	 * // Skips auth for paths starting with /public/ or exactly matching /health
	 */
	ignorePaths?: RegExp[];
}

/**
 * Creates an internal authentication middleware for HMAC-based request verification.
 *
 * This middleware validates incoming requests by:
 * 1. Checking if the request path matches any ignorePaths patterns (if configured)
 * 2. Checking for required authentication headers (signature, timestamp)
 * 3. Verifying the request timestamp to prevent replay attacks
 * 4. Computing the expected HMAC signature based on request data
 * 5. Comparing the computed signature with the provided signature using timing-safe comparison
 *
 * @template E - The environment bindings type (e.g., Cloudflare Bindings)
 * @param options - Configuration options for the middleware
 * @returns A Hono middleware handler
 *
 * @example
 * // Basic usage with Cloudflare Worker
 * app.use(createInternalAuthMiddleware<IHonoContext>({
 *   getSecret: async (c) => await c.env.SECRET_INTERNAL_HMAC_KEY.get()
 * }));
 *
 * @example
 * // Skip authentication for public routes
 * app.use(createInternalAuthMiddleware<IHonoContext>({
 *   getSecret: async (c) => await c.env.SECRET_INTERNAL_HMAC_KEY.get(),
 *   ignorePaths: [/^\/public\//, /^\/health$/]
 * }));
 *
 * @example
 * // With custom time tolerance
 * app.use(createInternalAuthMiddleware({
 *   getSecret: () => process.env.HMAC_SECRET,
 *   maxTimeDiff: 30000, // 30 seconds
 *   ignorePaths: [/^\/api\/webhook/]
 * }));
 */
export function createInternalAuthMiddleware<E extends Env = any>(
	options: InternalAuthOptions<E>,
): MiddlewareHandler<E> {
	const maxTimeDiff = options.maxTimeDiff ?? 1000 * 60; // Default: 60 seconds
	const ignorePaths = options.ignorePaths ?? [];

	return async (c, next) => {
		// 0. Check if path should be ignored
		if (ignorePaths.length > 0) {
			const url = new URL(c.req.url);
			const path = url.pathname;
			const shouldIgnore = ignorePaths.some((pattern) => pattern.test(path));
			if (shouldIgnore) {
				return next();
			}
		}

		// 1. Get HMAC secret key
		let hmacKey: string | undefined;
		try {
			hmacKey = await options.getSecret(c);
		} catch (e) {
			throw new StandardError({
				code: errorCode.AUTH_INTERNAL_MISSING,
				message: `Failed to retrieve HMAC secret: ${e instanceof Error ? e.message : String(e)}`,
			});
		}

		const signature = c.req.header('X-Internal-Signature');
		const timestamp = c.req.header('X-Internal-Timestamp');
		const skipBody = c.req.header('X-Internal-Skip-Body');

		// 2. Basic validation
		if (!signature || !timestamp || !hmacKey) {
			throw new StandardError({
				code: errorCode.AUTH_INTERNAL_MISSING,
				message: 'Missing authentication headers or secret',
			});
		}

		// 3. Replay attack prevention (timestamp validation)
		const reqTime = parseInt(timestamp, 10);
		const now = Date.now();
		if (Number.isNaN(reqTime) || Math.abs(now - reqTime) > maxTimeDiff) {
			throw new StandardError({
				code: errorCode.AUTH_INTERNAL_EXPIRED,
				message: 'Request timestamp expired',
			});
		}

		// 4. Read request body
		// Note: In Hono, after reading text(), subsequent handlers can still call json()
		// as long as we don't use the raw stream
		let bodyStr = '';
		if (skipBody === 'true') {
			bodyStr = SIGNATURE_SKIP_BODY_PAYLOAD;
		} else if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
			try {
				// Must clone to allow subsequent handlers to read the body
				bodyStr = await c.req.raw.clone().text();
			} catch (e) {
				console.error('Body read error', e);
			}
		}

		// 5. Compute expected signature
		const url = new URL(c.req.url);
		const expectedSignature = await computeInternalSignature({
			secret: hmacKey,
			method: c.req.method,
			path: url.pathname + url.search,
			timestamp,
			bodyStr,
			headersStr: buildSignedInternalHeadersString(c.req.raw.headers),
		});

		// 6. Timing-safe signature comparison
		const isValid = cryptoUtils.timingSafeEqual(expectedSignature, signature);

		if (!isValid) {
			throw new StandardError({
				code: errorCode.AUTH_INTERNAL_SIG_ERROR,
				message: 'HMAC Unauthorized',
			});
		}

		return next();
	};
}
