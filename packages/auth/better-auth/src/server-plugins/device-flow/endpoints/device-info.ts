import {
	APIError,
	createAuthEndpoint,
	sessionMiddleware,
} from 'better-auth/api';
import { z } from 'zod';
import { normalizeUserCode } from '../helpers/codes';
import { DEVICE_AUTHORIZATION_MODEL } from '../schema';
import type { IDeviceAuthorizationRow, IOAuthClientRow } from '../types';

const deviceInfoQuery = z.object({
	user_code: z.string().min(1),
});

export const deviceInfo = createAuthEndpoint(
	'/device/info',
	{
		method: 'GET',
		query: deviceInfoQuery,
		use: [sessionMiddleware],
	},
	async (ctx) => {
		const row = await ctx.context.adapter.findOne<IDeviceAuthorizationRow>({
			model: DEVICE_AUTHORIZATION_MODEL,
			where: [
				{
					field: 'userCode',
					value: normalizeUserCode(ctx.query.user_code),
				},
			],
		});
		if (!row || row.status !== 'pending' || row.expiresAt <= new Date()) {
			throw new APIError('BAD_REQUEST', {
				error: 'invalid_user_code',
				error_description: 'Device authorization request is not pending',
			});
		}

		const client = await ctx.context.adapter.findOne<IOAuthClientRow>({
			model: 'oauthClient',
			where: [{ field: 'clientId', value: row.clientId }],
		});
		if (!client) {
			throw new APIError('BAD_REQUEST', {
				error: 'invalid_client',
				error_description: 'Device flow client no longer exists',
			});
		}

		return ctx.json({
			client: {
				client_id: client.clientId,
				name: client.name ?? client.clientId,
				icon: client.icon ?? null,
			},
			scopes: row.scopes,
			resource: row.resource,
			created_ip: row.createdIp ?? null,
			created_ua: row.createdUa ?? null,
			expires_at: row.expiresAt.toISOString(),
		});
	},
);
