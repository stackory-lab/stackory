import { createAuthEndpoint } from 'better-auth/api';
import { z } from 'zod';
import type { INormalizedDeviceFlowOptions } from '../types';

const deviceRedirectQuery = z.object({
	user_code: z.string().optional(),
});

export const createDeviceRedirectEndpoint = (
	options: INormalizedDeviceFlowOptions,
) => {
	return createAuthEndpoint(
		'/device',
		{
			method: 'GET',
			query: deviceRedirectQuery,
		},
		async (ctx) => {
			const location = new URL(options.verificationUri);
			if (ctx.query.user_code) {
				location.searchParams.set('user_code', ctx.query.user_code);
			}

			return new Response(null, {
				status: 302,
				headers: {
					location: location.toString(),
				},
			});
		},
	);
};
