import { createAuthEndpoint } from 'better-auth/api';
import { z } from 'zod';
import {
	assertAllowedClient,
	assertValidResources,
	parseResource,
	resolveScopes,
	splitScope,
} from '../helpers/client-policy';
import {
	generateDeviceCode,
	generateUserCode,
	hashDeviceCode,
	normalizeUserCode,
} from '../helpers/codes';
import { DEVICE_AUTHORIZATION_MODEL } from '../schema';
import type { INormalizedDeviceFlowOptions, IOAuthClientRow } from '../types';

const deviceCodeBody = z.object({
	client_id: z.string().min(1),
	scope: z.string().optional(),
	resource: z.union([z.string(), z.array(z.string())]).optional(),
	code_challenge: z.string().min(1),
	code_challenge_method: z.literal('S256'),
});

export const createDeviceCodeEndpoint = (
	options: INormalizedDeviceFlowOptions,
) => {
	return createAuthEndpoint(
		'/device/code',
		{
			method: 'POST',
			body: deviceCodeBody,
			metadata: {
				allowedMediaTypes: [
					'application/x-www-form-urlencoded',
					'application/json',
				],
			},
		},
		async (ctx) => {
			const client = assertAllowedClient(
				await ctx.context.adapter.findOne<IOAuthClientRow>({
					model: 'oauthClient',
					where: [{ field: 'clientId', value: ctx.body.client_id }],
				}),
				options.allowedClientIds,
			);
			const requestedScopes = ctx.body.scope
				? splitScope(ctx.body.scope)
				: (client.scopes ?? []);
			const scopes = resolveScopes(requestedScopes, client.scopes ?? []);
			const resource = assertValidResources(
				parseResource(ctx.body.resource, options.defaultResources),
				options.validResources,
			);
			const deviceCode = generateDeviceCode();
			const userCode = generateUserCode();
			const now = new Date();
			const expiresAt = new Date(now.getTime() + options.codeTtlSec * 1000);

			await ctx.context.adapter.create({
				model: DEVICE_AUTHORIZATION_MODEL,
				data: {
					deviceCodeHash: await hashDeviceCode(deviceCode),
					userCode: normalizeUserCode(userCode),
					clientId: client.clientId,
					scopes,
					resource,
					codeChallenge: ctx.body.code_challenge,
					codeChallengeMethod: ctx.body.code_challenge_method,
					status: 'pending',
					pollInterval: options.defaultIntervalSec,
					createdIp: ctx.headers?.get('x-forwarded-for') ?? null,
					createdUa: ctx.headers?.get('user-agent') ?? null,
					expiresAt,
					createdAt: now,
				},
			});

			const verificationUriComplete = new URL(options.verificationUri);
			verificationUriComplete.searchParams.set('user_code', userCode);

			return ctx.json({
				device_code: deviceCode,
				user_code: userCode,
				verification_uri: options.verificationUri,
				verification_uri_complete: verificationUriComplete.toString(),
				expires_in: options.codeTtlSec,
				interval: options.defaultIntervalSec,
			});
		},
	);
};
