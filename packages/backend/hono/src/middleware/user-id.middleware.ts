import { error } from '@stackory/constants';
import type { MiddlewareHandler } from 'hono';

const { errorCode, StandardError } = error;

/**
 * Auth middleware - extracts userId from X-User-Id header
 * and adds it to the context variables
 */
export const userIdMiddleware: MiddlewareHandler = async (c, next) => {
	const userId = c.req.header('X-User-Id');

	if (userId) {
		c.set('userId', userId);
	} else {
		throw new StandardError({
			code: errorCode.AUTH_USER_ID_MISSING,
			message: 'No X-User-Id in headers',
		});
	}

	await next();
};
