import { createAuthEndpoint } from 'better-auth/api';
import { z } from 'zod';
import { DEVICE_CODE_GRANT_TYPE } from '../../../shared/constants';
import { casUpdateDeviceAuthorization } from '../helpers/cas';
import { hashDeviceCode } from '../helpers/codes';
import { oauthError } from '../helpers/oauth-error';
import { DEVICE_AUTHORIZATION_MODEL } from '../schema';
import type {
	IDeviceAuthorizationRow,
	INormalizedDeviceFlowOptions,
} from '../types';

const deviceTokenBody = z.object({
	grant_type: z.literal(DEVICE_CODE_GRANT_TYPE),
	device_code: z.string().min(1),
	client_id: z.string().min(1),
	code_verifier: z.string().min(1),
});

const POLL_INTERVAL_INCREMENT_SEC = 5;
const POLL_INTERVAL_MAX_SEC = 30;

const expireIfAllowed = async (
	ctx: {
		context: {
			adapter: Parameters<typeof casUpdateDeviceAuthorization>[0]['adapter'];
		};
	},
	row: IDeviceAuthorizationRow,
) => {
	if (
		row.status === 'pending' ||
		row.status === 'approved' ||
		row.status === 'denied'
	) {
		await casUpdateDeviceAuthorization({
			adapter: ctx.context.adapter,
			id: row.id,
			from: row.status,
			update: {
				status: 'expired',
			},
		});
	}
};

export const createDeviceTokenEndpoint = (
	options: INormalizedDeviceFlowOptions,
) => {
	return createAuthEndpoint(
		'/device/token',
		{
			method: 'POST',
			body: deviceTokenBody,
			metadata: {
				allowedMediaTypes: [
					'application/x-www-form-urlencoded',
					'application/json',
				],
			},
		},
		async (ctx) => {
			const row = await ctx.context.adapter.findOne<IDeviceAuthorizationRow>({
				model: DEVICE_AUTHORIZATION_MODEL,
				where: [
					{
						field: 'deviceCodeHash',
						value: await hashDeviceCode(ctx.body.device_code),
					},
				],
			});
			if (!row || row.clientId !== ctx.body.client_id) {
				throw oauthError('invalid_grant');
			}

			const now = new Date();
			if (
				row.status === 'consuming' ||
				row.status === 'consumed' ||
				row.status === 'failed'
			) {
				throw oauthError('invalid_grant');
			}
			if (row.expiresAt <= now || row.status === 'expired') {
				await expireIfAllowed(ctx, row);
				throw oauthError('expired_token');
			}
			if (
				row.lastPolledAt &&
				now.getTime() - row.lastPolledAt.getTime() < row.pollInterval * 1000
			) {
				await ctx.context.adapter.updateMany({
					model: DEVICE_AUTHORIZATION_MODEL,
					where: [{ field: 'id', value: row.id }],
					update: {
						pollInterval: Math.min(
							row.pollInterval + POLL_INTERVAL_INCREMENT_SEC,
							POLL_INTERVAL_MAX_SEC,
						),
						lastPolledAt: now,
					},
				});
				throw oauthError('slow_down');
			}
			await ctx.context.adapter.updateMany({
				model: DEVICE_AUTHORIZATION_MODEL,
				where: [{ field: 'id', value: row.id }],
				update: {
					lastPolledAt: now,
				},
			});

			switch (row.status) {
				case 'pending':
				case 'approving':
					throw oauthError('authorization_pending');
				case 'denied':
					throw oauthError('access_denied');
				case 'approved':
					break;
				default:
					throw oauthError('invalid_grant');
			}

			if (!options.issueAccessToken) {
				throw oauthError(
					'temporarily_unavailable',
					'Device token bridge is not configured',
				);
			}
			if (!row.authorizationCode) {
				throw oauthError('invalid_grant');
			}

			const claimed = await casUpdateDeviceAuthorization({
				adapter: ctx.context.adapter,
				id: row.id,
				from: 'approved',
				update: {
					status: 'consuming',
					consumingStartedAt: now,
				},
			});
			if (claimed !== 1) {
				throw oauthError('invalid_grant');
			}

			let tokenResponse: Awaited<ReturnType<typeof options.issueAccessToken>>;
			try {
				tokenResponse = await options.issueAccessToken({
					clientId: row.clientId,
					authorizationCode: row.authorizationCode,
					codeVerifier: ctx.body.code_verifier,
					resource: row.resource,
					headers: ctx.headers,
				});
			} catch (error) {
				const rollbacked = await casUpdateDeviceAuthorization({
					adapter: ctx.context.adapter,
					id: row.id,
					from: 'consuming',
					update: {
						status: 'failed',
						failureReason:
							error instanceof Error ? error.message : 'token_exchange_failed',
						failedAt: new Date(),
					},
				});
				if (rollbacked !== 1) {
					ctx.context.logger.warn('device.token.rollback_cas_miss', {
						deviceId: row.id,
					});
				}
				throw oauthError('invalid_grant');
			}

			const consumed = await casUpdateDeviceAuthorization({
				adapter: ctx.context.adapter,
				id: row.id,
				from: 'consuming',
				update: {
					status: 'consumed',
					authorizationCode: null,
					consumedAt: new Date(),
				},
			});
			if (consumed !== 1) {
				ctx.context.logger.error('device.token.terminal_cas_miss', {
					deviceId: row.id,
				});
				throw oauthError('invalid_grant');
			}

			return ctx.json(tokenResponse);
		},
	);
};
