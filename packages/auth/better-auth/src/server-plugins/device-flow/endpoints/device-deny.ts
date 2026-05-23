import {
	APIError,
	createAuthEndpoint,
	freshSessionMiddleware,
} from 'better-auth/api';
import { z } from 'zod';
import { casUpdateDeviceAuthorization } from '../helpers/cas';
import { normalizeUserCode } from '../helpers/codes';
import { DEVICE_AUTHORIZATION_MODEL } from '../schema';
import type { IDeviceAuthorizationRow } from '../types';

const deviceDenyBody = z.object({
	user_code: z.string().min(1),
});

export const deviceDeny = createAuthEndpoint(
	'/device/deny',
	{
		method: 'POST',
		body: deviceDenyBody,
		use: [freshSessionMiddleware],
	},
	async (ctx) => {
		const row = await ctx.context.adapter.findOne<IDeviceAuthorizationRow>({
			model: DEVICE_AUTHORIZATION_MODEL,
			where: [
				{
					field: 'userCode',
					value: normalizeUserCode(ctx.body.user_code),
				},
			],
		});
		if (!row || row.status !== 'pending' || row.expiresAt <= new Date()) {
			throw new APIError('BAD_REQUEST', {
				error: 'invalid_user_code',
				error_description: 'Device authorization request is not pending',
			});
		}

		const claimed = await casUpdateDeviceAuthorization({
			adapter: ctx.context.adapter,
			id: row.id,
			from: 'pending',
			update: {
				status: 'denied',
				decidedAt: new Date(),
			},
		});
		if (claimed !== 1) {
			throw new APIError('CONFLICT', {
				error: 'concurrent_decision',
				error_description: 'Device authorization was already decided',
			});
		}

		return ctx.json({ status: 'denied' });
	},
);
