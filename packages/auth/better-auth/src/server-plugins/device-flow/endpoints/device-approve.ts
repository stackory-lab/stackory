import {
	APIError,
	createAuthEndpoint,
	freshSessionMiddleware,
} from 'better-auth/api';
import { z } from 'zod';
import { casUpdateDeviceAuthorization } from '../helpers/cas';
import {
	assertAllowedClient,
	assertValidResources,
	resolveScopes,
	splitScope,
} from '../helpers/client-policy';
import { normalizeUserCode } from '../helpers/codes';
import { DEVICE_AUTHORIZATION_MODEL } from '../schema';
import type {
	IDeviceAuthorizationRow,
	INormalizedDeviceFlowOptions,
	IOAuthClientRow,
} from '../types';

const deviceApproveBody = z.object({
	user_code: z.string().min(1),
	scope: z.string().optional(),
});

export const createDeviceApproveEndpoint = (
	options: INormalizedDeviceFlowOptions,
) => {
	return createAuthEndpoint(
		'/device/approve',
		{
			method: 'POST',
			body: deviceApproveBody,
			use: [freshSessionMiddleware],
		},
		async (ctx) => {
			const session = ctx.context.session;
			if (!session) {
				throw new APIError('UNAUTHORIZED', {
					message: 'Unauthorized',
					code: 'UNAUTHORIZED',
				});
			}
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
			if (!options.issueAuthorizationCode) {
				throw new APIError('BAD_REQUEST', {
					error: 'temporarily_unavailable',
					error_description: 'Device approval bridge is not configured',
				});
			}

			const client = assertAllowedClient(
				await ctx.context.adapter.findOne<IOAuthClientRow>({
					model: 'oauthClient',
					where: [{ field: 'clientId', value: row.clientId }],
				}),
				options.allowedClientIds,
			);
			const scopes = resolveScopes(
				ctx.body.scope ? splitScope(ctx.body.scope) : row.scopes,
				client.scopes ?? [],
			);
			const resource = assertValidResources(
				row.resource,
				options.validResources,
			);

			const claimed = await casUpdateDeviceAuthorization({
				adapter: ctx.context.adapter,
				id: row.id,
				from: 'pending',
				update: {
					status: 'approving',
					approvingStartedAt: new Date(),
				},
			});
			if (claimed !== 1) {
				throw new APIError('CONFLICT', {
					error: 'concurrent_decision',
					error_description: 'Device authorization was already decided',
				});
			}

			let authorizationCode: string;
			try {
				authorizationCode = await options.issueAuthorizationCode({
					clientId: row.clientId,
					userId: session.user.id,
					scopes,
					resource,
					codeChallenge: row.codeChallenge,
					codeChallengeMethod: row.codeChallengeMethod,
					headers: ctx.headers,
				});
			} catch (error) {
				const rollbacked = await casUpdateDeviceAuthorization({
					adapter: ctx.context.adapter,
					id: row.id,
					from: 'approving',
					update: {
						status: 'failed',
						failureReason:
							error instanceof Error ? error.message : 'authorization_failed',
						failedAt: new Date(),
					},
				});
				if (rollbacked !== 1) {
					ctx.context.logger.warn('device.approve.rollback_cas_miss', {
						deviceId: row.id,
					});
				}
				throw error;
			}

			const done = await casUpdateDeviceAuthorization({
				adapter: ctx.context.adapter,
				id: row.id,
				from: 'approving',
				update: {
					status: 'approved',
					userId: session.user.id,
					scopes,
					resource,
					authorizationCode,
					decidedAt: new Date(),
				},
			});
			if (done !== 1) {
				ctx.context.logger.error('device.approve.terminal_cas_miss', {
					deviceId: row.id,
				});
				throw new APIError('CONFLICT', {
					error: 'state_changed',
					error_description: 'Device authorization state changed',
				});
			}

			return ctx.json({ status: 'approved' });
		},
	);
};
