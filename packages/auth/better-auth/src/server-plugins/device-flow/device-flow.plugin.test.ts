import { describe, expect, it } from 'vitest';
import { DEVICE_CODE_GRANT_TYPE } from '../../shared/constants';
import { deviceFlowPlugin } from './device-flow.plugin';
import {
	DEVICE_AUTHORIZATION_MODEL,
	deviceAuthorizationSchema,
} from './schema';
import { DEVICE_AUTHORIZATION_STATUSES } from './types';

describe('deviceFlowPlugin', () => {
	it('declares the deviceAuthorization schema required by M2', () => {
		const fields = deviceAuthorizationSchema[DEVICE_AUTHORIZATION_MODEL].fields;

		expect(fields.deviceCodeHash.unique).toBe(true);
		expect(fields.userCode.unique).toBe(true);
		expect(fields.clientId.references).toEqual({
			model: 'oauthClient',
			field: 'clientId',
			onDelete: 'cascade',
		});
		expect(fields.resource).toMatchObject({
			type: 'string[]',
			required: true,
		});
		expect(fields.status).toMatchObject({
			type: 'string',
			required: true,
		});
		expect(fields.consumingStartedAt).toMatchObject({
			type: 'date',
			required: false,
		});
		expect(fields.failureReason).toMatchObject({
			type: 'string',
			required: false,
		});
		expect(deviceAuthorizationSchema.deviceAuthorization.disableMigration).toBe(
			true,
		);
		expect(DEVICE_AUTHORIZATION_STATUSES).toContain('consuming');
	});

	it('normalizes options without allowing device flow by default', () => {
		const plugin = deviceFlowPlugin({
			verificationUri: 'https://web.example.com/device',
		});

		expect(plugin.id).toBe('device-flow-plugin');
		expect(plugin.options).toEqual({
			codeTtlSec: 600,
			defaultIntervalSec: 5,
			allowedClientIds: [],
			verificationUri: 'https://web.example.com/device',
			defaultResources: [],
			validResources: [],
		});
		expect(plugin.schema).toBe(deviceAuthorizationSchema);
		expect(Object.keys(plugin.endpoints ?? {})).toEqual([
			'deviceCode',
			'deviceToken',
			'deviceInfo',
			'deviceApprove',
			'deviceDeny',
			'deviceRedirect',
		]);
		expect(plugin.$Infer.deviceCodeGrantType).toBe(DEVICE_CODE_GRANT_TYPE);
	});

	it('rejects relative verificationUri because RFC 8628 requires absolute URI', () => {
		expect(() => deviceFlowPlugin({ verificationUri: '/device' })).toThrowError(
			/absolute http\(s\) URL/,
		);
	});

	it('rejects non-http schemes', () => {
		expect(() =>
			deviceFlowPlugin({ verificationUri: 'javascript:alert(1)' }),
		).toThrowError(/absolute http\(s\) URL/);
	});

	it('keeps explicit allowlist and timing options', () => {
		const plugin = deviceFlowPlugin({
			codeTtlSec: 300,
			defaultIntervalSec: 10,
			allowedClientIds: ['swarm-cli'],
			verificationUri: 'https://web.example.com/device',
			defaultResources: ['https://api.example.com'],
			validResources: ['https://api.example.com'],
		});

		expect(plugin.options).toEqual({
			codeTtlSec: 300,
			defaultIntervalSec: 10,
			allowedClientIds: ['swarm-cli'],
			verificationUri: 'https://web.example.com/device',
			defaultResources: ['https://api.example.com'],
			validResources: ['https://api.example.com'],
		});
	});
});
